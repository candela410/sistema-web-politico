"""Historial de actividad sobre el registro de Django (tabla django_admin_log,
modelo LogEntry).

Cada movimiento de la API se guarda como un LogEntry. En change_message va una
lista JSON compatible con el admin de Django ({"changed": {"fields": [...]}})
y además un bloque {"bitacora": {...}} con la campaña, la acción, el detalle y
los valores anteriores y nuevos de cada campo modificado.
"""

import json
from datetime import date, datetime
from decimal import Decimal

from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.contenttypes.models import ContentType

ACCIONES = {"crear": ADDITION, "editar": CHANGE, "borrar": DELETION, "sesion": CHANGE}


def _valor(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (list, tuple)):
        return ", ".join(str(x) for x in v)
    return v


def diferencias(antes, despues):
    """Compara dos fotos {etiqueta: valor} y devuelve solo lo que cambió."""
    cambios = []
    for campo in despues:
        viejo, nuevo = _valor(antes.get(campo)), _valor(despues.get(campo))
        if viejo != nuevo:
            cambios.append({"campo": campo, "antes": viejo, "despues": nuevo})
    return cambios


def registrar(request, objeto, accion, *, cambios=None, detalle="", campana=None):
    """Guarda un movimiento. accion: "crear", "editar", "borrar" o "sesion"."""
    if campana is None:
        campana = getattr(request, "campana", None)
    mensaje = []
    if accion == "crear":
        mensaje.append({"added": {}})
    elif accion == "editar" and cambios:
        mensaje.append({"changed": {"fields": [c["campo"] for c in cambios]}})
    elif accion == "borrar":
        mensaje.append({"deleted": {}})
    mensaje.append({
        "bitacora": {
            "campana": campana.pk if campana else None,
            "accion": accion,
            "cambios": cambios or [],
            "detalle": detalle,
        }
    })
    LogEntry.objects.create(
        user_id=request.user.pk,
        content_type=ContentType.objects.get_for_model(objeto, for_concrete_model=False),
        object_id=str(objeto.pk),
        object_repr=str(objeto)[:200],
        action_flag=ACCIONES[accion],
        change_message=json.dumps(mensaje, ensure_ascii=False, default=str),
    )


def leer(entrada):
    """Convierte un LogEntry en el formato que muestra el historial. Los
    movimientos hechos desde el admin de Django no traen valores anteriores."""
    datos = {}
    try:
        for parte in json.loads(entrada.change_message or "[]"):
            if isinstance(parte, dict) and "bitacora" in parte:
                datos = parte["bitacora"]
    except (ValueError, TypeError):
        pass
    accion = datos.get("accion") or {ADDITION: "crear", CHANGE: "editar", DELETION: "borrar"}[entrada.action_flag]
    usuario = entrada.user
    return {
        "id": entrada.pk,
        "fecha": entrada.action_time.isoformat(),
        "usuario": {
            "id": usuario.pk,
            "nombre": f"{usuario.first_name} {usuario.last_name}".strip() or usuario.email,
            "email": usuario.email,
        },
        "accion": accion,
        "seccion": entrada.content_type.model_class()._meta.verbose_name.capitalize()
        if entrada.content_type and entrada.content_type.model_class()
        else "",
        "objeto": entrada.object_repr,
        "cambios": datos.get("cambios", []),
        "detalle": datos.get("detalle") or ("" if datos else entrada.get_change_message()),
        "desde_admin": not datos,
    }
