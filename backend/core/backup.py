"""Backup completo (full) de la base con la API de Neon.

Cada backup es un *snapshot* de Neon: una copia de toda la base (estructura y
datos) tal como estaba en ese momento. Se guardan en Neon, no en el servidor.

- crear():      saca un snapshot de la rama principal (production).
- listar():     los snapshots del proyecto, del más nuevo al más viejo.
- restaurar():  reemplaza la base actual por la de un snapshot. Neon conserva
                lo que había como una rama aparte ("production (old)").
- borrar():     elimina un snapshot.

Hacen falta NEON_API_KEY y NEON_PROJECT_ID en el .env (ver .env.example).
El plan Free de Neon admite un solo snapshot manual (NEON_MAX_SNAPSHOTS=1): al
crear uno nuevo se reemplaza el anterior.

Backup automático: la programación está en la tabla configuracion_backup. No
hay un cron aparte: un hilo de este mismo proceso espera hasta el horario
elegido. Si a esa hora el servidor estaba dormido (Render lo suspende cuando
nadie lo usa), el backup se hace apenas vuelve a recibir un pedido; mientras
nadie usó el sistema los datos tampoco cambiaron.

API de Neon: https://api-docs.neon.tech/reference/getting-started-with-neon-api
"""

import json
import logging
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from django.conf import settings
from django.db import connections
from django.db.models import Q
from django.utils import timezone

from .models import ConfiguracionBackup

registro = logging.getLogger(__name__)

API = "https://console.neon.tech/api/v2"
AUTOMATICO = "auto-"
MANUAL = "manual-"
ID_VALIDO = re.compile(r"^[\w-]{1,80}$")


class ErrorNeon(Exception):
    def __init__(self, mensaje, status=None):
        super().__init__(mensaje)
        self.status = status


# ---------------------------------------------------------------------------
# Cliente de la API de Neon
# ---------------------------------------------------------------------------


def faltantes():
    """Variables del .env que faltan para poder usar la API de Neon."""
    return [n for n in ("NEON_API_KEY", "NEON_PROJECT_ID") if not getattr(settings, n)]


def configurado():
    return not faltantes()


def _pedir(metodo, ruta, cuerpo=None, parametros=None):
    if not configurado():
        raise ErrorNeon("Falta configurar la conexión con Neon (NEON_API_KEY y NEON_PROJECT_ID).")
    url = f"{API}/projects/{urllib.parse.quote(settings.NEON_PROJECT_ID)}{ruta}"
    if parametros:
        url += "?" + urllib.parse.urlencode(parametros)
    pedido = urllib.request.Request(
        url,
        method=metodo,
        data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
        headers={
            "Authorization": f"Bearer {settings.NEON_API_KEY}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(pedido, timeout=60) as respuesta:
            texto = respuesta.read().decode() or "{}"
    except urllib.error.HTTPError as e:
        try:
            detalle = json.loads(e.read().decode()).get("message", "")
        except (ValueError, AttributeError):
            detalle = ""
        if e.code in (401, 403) and not detalle:
            detalle = "la clave de la API (NEON_API_KEY) no es válida o no tiene acceso al proyecto"
        raise ErrorNeon(f"Neon respondió con un error ({e.code}): {detalle or e.reason}", e.code) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise ErrorNeon("No se pudo conectar con Neon. Intente nuevamente en unos minutos.") from None
    try:
        return json.loads(texto)
    except ValueError:
        return {}


def rama_principal():
    """Id de la rama de la que se saca el backup: NEON_BRANCH_ID o, si no se
    indicó, la rama principal del proyecto. Se consulta cada vez porque al
    restaurar un snapshot Neon le cambia el id a la rama."""
    if settings.NEON_BRANCH_ID:
        return settings.NEON_BRANCH_ID
    ramas = _pedir("GET", "/branches").get("branches", [])
    for rama in ramas:
        if rama.get("default") or rama.get("primary"):
            return rama["id"]
    raise ErrorNeon("No se encontró la rama principal del proyecto en Neon.")


def _snapshot(s):
    nombre = s.get("name") or s.get("id")
    return {
        "id": s.get("id"),
        "nombre": nombre,
        "creado": s.get("created_at") or s.get("timestamp"),
        "automatico": str(nombre).startswith(AUTOMATICO),
    }


def listar():
    snapshots = [_snapshot(s) for s in _pedir("GET", "/snapshots").get("snapshots", [])]
    return sorted(snapshots, key=lambda s: s["creado"] or "", reverse=True)


def borrar(id_snapshot):
    _pedir("DELETE", f"/snapshots/{urllib.parse.quote(id_snapshot)}")


def crear(automatico=False):
    """Saca un backup completo. Si ya se llegó al máximo de snapshots que
    admite el plan, se borra el más viejo y se vuelve a intentar (el nuevo
    reemplaza al anterior). Devuelve el nombre del backup creado."""
    nombre = f"{AUTOMATICO if automatico else MANUAL}{timezone.localtime():%Y-%m-%d-%H%M%S}"
    rama = rama_principal()
    existentes = listar()

    def sacar():
        _pedir("POST", f"/branches/{urllib.parse.quote(rama)}/snapshot", parametros={"name": nombre})

    try:
        sacar()
    except ErrorNeon as e:
        maximo = settings.NEON_MAX_SNAPSHOTS
        # Un error de clave, de proyecto o del servidor de Neon no se arregla borrando backups
        if len(existentes) < maximo or e.status in (None, 401, 404) or e.status >= 500:
            raise
        for viejo in existentes[maximo - 1:]:
            borrar(viejo["id"])
        sacar()
    else:
        # Con lugar de sobra (plan pago) se conservan solo los últimos NEON_MAX_SNAPSHOTS
        for viejo in existentes[max(settings.NEON_MAX_SNAPSHOTS - 1, 0):]:
            try:
                borrar(viejo["id"])
            except ErrorNeon:
                pass
    return nombre


def restaurar(id_snapshot):
    """Reemplaza la base actual por la del snapshot. La dirección de conexión
    (DATABASE_URL) no cambia; las conexiones abiertas se cortan."""
    _pedir(
        "POST",
        f"/snapshots/{urllib.parse.quote(id_snapshot)}/restore",
        cuerpo={"target_branch_id": rama_principal(), "finalize_restore": True},
    )
    connections.close_all()


# ---------------------------------------------------------------------------
# Backup automático
# ---------------------------------------------------------------------------


def _horario(config, ahora, siguiente):
    """El horario programado anterior (o igual) a `ahora`, o el siguiente."""
    momento = ahora.replace(hour=config.hora.hour, minute=config.hora.minute, second=0, microsecond=0)
    paso = timedelta(days=1 if siguiente else -1)
    if (momento <= ahora) if siguiente else (momento > ahora):
        momento += paso
    if config.frecuencia == ConfiguracionBackup.Frecuencia.SEMANAL:
        while momento.weekday() != config.dia_semana:
            momento += paso
    return momento


def proximo(config, ahora=None):
    return _horario(config, ahora or timezone.localtime(), siguiente=True)


def revisar():
    """Hace el backup automático si pasó un horario programado que todavía no
    se atendió. Devuelve los segundos que faltan para el próximo horario, o
    None si el backup automático está apagado."""
    config = ConfiguracionBackup.objects.filter(pk=1).first()
    if config is None or not config.activo:
        return None
    ahora = timezone.localtime()
    debido = _horario(config, ahora, siguiente=False)
    if config.controlado_hasta is None or config.controlado_hasta < debido:
        # Con varios procesos (gunicorn), solo el que logra marcarlo hace el backup
        tomado = (
            ConfiguracionBackup.objects.filter(pk=1)
            .filter(Q(controlado_hasta__isnull=True) | Q(controlado_hasta__lt=debido))
            .update(controlado_hasta=ahora)
        )
        if tomado:
            try:
                crear(automatico=True)
            except ErrorNeon as e:
                registro.warning("Backup automático: %s", e)
                ConfiguracionBackup.objects.filter(pk=1).update(ultimo_error=str(e))
            else:
                ConfiguracionBackup.objects.filter(pk=1).update(ultimo_automatico=timezone.now(), ultimo_error="")
    return max(30.0, (proximo(config, ahora) - ahora).total_seconds() + 5)


_candado = threading.Lock()
_despertar = threading.Event()
_estado = {"hilo": None, "revisado": 0.0}


def _bucle():
    while True:
        _estado["revisado"] = time.monotonic()
        try:
            espera = revisar()
        except Exception:  # noqa: BLE001 - el hilo no debe morir por un error de la base
            registro.exception("No se pudo revisar el backup automático")
            espera = 300
        finally:
            connections.close_all()
        # Apagado: duerme hasta el próximo pedido. Así no se consulta la base
        # cuando nadie usa el sistema (y Neon puede suspenderla).
        _despertar.wait(timeout=espera)
        _despertar.clear()


def latido():
    """Lo llama cada pedido a la API: arranca el hilo del backup automático y,
    como mucho una vez por minuto, le hace revisar la programación (por si
    cambió o si el servidor estuvo dormido a la hora del backup)."""
    if not configurado():
        return
    with _candado:
        hilo = _estado["hilo"]
        if hilo is None or not hilo.is_alive():
            _estado["hilo"] = threading.Thread(target=_bucle, name="backup-automatico", daemon=True)
            _estado["hilo"].start()
        elif time.monotonic() - _estado["revisado"] > 60:
            _despertar.set()


def programador(get_response):
    """Middleware (settings.MIDDLEWARE)."""

    def middleware(request):
        if request.path.startswith("/api/"):
            latido()
        return get_response(request)

    return middleware


def momento_iso(valor):
    return valor.isoformat() if isinstance(valor, datetime) else None
