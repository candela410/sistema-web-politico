"""Configuración → Backup: backups completos de la base (snapshots de Neon) y
programación del backup automático. Solo para superusuarios: restaurar un
backup reemplaza todos los datos del sistema."""

from datetime import time
from functools import wraps

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from . import backup
from .api import campana_activa, error, leer_json
from .bitacora import registrar
from .models import ConfiguracionBackup

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
PALABRA = "RESTAURAR"


def solo_superusuario(vista):
    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return error("Debe iniciar sesión.", 401)
        if not request.user.is_superuser:
            return error("Solo un superusuario puede administrar los backups.", 403)
        return vista(request, *args, **kwargs)

    return envoltura


def _programacion(config):
    return {
        "activo": config.activo,
        "frecuencia": config.frecuencia,
        "dia_semana": config.dia_semana,
        "hora": f"{config.hora:%H:%M}",
        "proximo": backup.momento_iso(backup.proximo(config)) if config.activo else None,
        "ultimo_automatico": backup.momento_iso(config.ultimo_automatico),
        "ultimo_error": config.ultimo_error,
    }


def _estado(aviso=""):
    datos = {
        "configurado": backup.configurado(),
        "faltan": backup.faltantes(),
        "maximo": backup.settings.NEON_MAX_SNAPSHOTS,
        "backups": [],
        "error_neon": "",
        "aviso": aviso,
        "programacion": _programacion(ConfiguracionBackup.actual()),
    }
    if datos["configurado"]:
        try:
            datos["backups"] = backup.listar()
        except backup.ErrorNeon as e:
            datos["error_neon"] = str(e)
    return JsonResponse(datos)


def _anotar(request, detalle):
    # Después de restaurar, el usuario o la campaña pueden no existir en la base
    try:
        registrar(request, ConfiguracionBackup.actual(), "editar", detalle=detalle, campana=campana_activa(request))
    except Exception:  # noqa: BLE001
        pass


@require_http_methods(["GET", "POST"])
@solo_superusuario
def backups(request):
    """GET: backups guardados y programación. POST: hace un backup ahora."""
    if request.method == "GET":
        return _estado()
    try:
        nombre = backup.crear()
    except backup.ErrorNeon as e:
        return error(str(e), 502)
    _anotar(request, f"Hizo un backup completo de la base ({nombre})")
    return _estado(f"Se hizo el backup {nombre}.")


@require_http_methods(["DELETE"])
@solo_superusuario
def backup_detalle(request, pk):
    if not backup.ID_VALIDO.match(pk):
        return error("El backup no existe.", 404)
    try:
        backup.borrar(pk)
    except backup.ErrorNeon as e:
        return error(str(e), 502)
    _anotar(request, "Borró un backup de la base")
    return _estado("Se borró el backup.")


@require_http_methods(["POST"])
@solo_superusuario
def restaurar(request, pk):
    """POST {confirmacion: "RESTAURAR"}: la base vuelve a como estaba en ese backup."""
    datos = leer_json(request) or {}
    if datos.get("confirmacion") != PALABRA:
        return error(f"Para restaurar escriba {PALABRA}.")
    if not backup.ID_VALIDO.match(pk):
        return error("El backup no existe.", 404)
    try:
        backup.restaurar(pk)
    except backup.ErrorNeon as e:
        return error(str(e), 502)
    _anotar(request, "Restauró la base desde un backup")
    return JsonResponse({"ok": True})


@require_http_methods(["PATCH"])
@solo_superusuario
def programacion(request):
    """PATCH {activo, frecuencia, dia_semana, hora: "HH:MM"}."""
    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    config = ConfiguracionBackup.actual()

    activo = datos.get("activo", config.activo)
    frecuencia = datos.get("frecuencia", config.frecuencia)
    dia = datos.get("dia_semana", config.dia_semana)
    if not isinstance(activo, bool):
        return error("El estado no es válido.")
    if frecuencia not in ConfiguracionBackup.Frecuencia.values:
        return error("La frecuencia no es válida.")
    if isinstance(dia, bool) or not isinstance(dia, int) or not 0 <= dia <= 6:
        return error("El día de la semana no es válido.")
    hora = config.hora
    if "hora" in datos:
        try:
            hora = time.fromisoformat(str(datos["hora"])).replace(second=0, microsecond=0, tzinfo=None)
        except ValueError:
            return error("La hora no es válida (use el formato HH:MM).")
    if activo and not backup.configurado():
        return error("Primero configure la conexión con Neon (NEON_API_KEY y NEON_PROJECT_ID).", 409)

    config.activo, config.frecuencia, config.dia_semana, config.hora = activo, frecuencia, dia, hora
    # La programación nueva rige desde ahora: no se "recupera" un horario anterior
    config.controlado_hasta = timezone.now()
    config.save()
    backup.latido()
    backup._despertar.set()
    cuando = "todos los días" if frecuencia == "diaria" else f"los {DIAS[dia]}"
    _anotar(
        request,
        f"Programó el backup automático {cuando} a las {hora:%H:%M}" if activo else "Desactivó el backup automático",
    )
    return _estado("Se guardó la programación.")
