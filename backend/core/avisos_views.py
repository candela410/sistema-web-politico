"""Avisos de la campanita (barra superior).

Lee las notificaciones del usuario de la tabla notificaciones (las crea
core/notificaciones.py cuando pasa algo). Lo leído queda guardado en la base,
así no vuelven a aparecer como nuevas en otra computadora.
"""

from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .api import error, leer_json, requiere_permiso
from .models import Notificacion, PreferenciaNotificacion
from .notificaciones import DESCRIPCIONES, tipos_de

# Avisos de los últimos DIAS días, como mucho MAXIMO
DIAS = 30
MAXIMO = 20


def _json(n):
    return {
        "id": n.pk,
        "tipo": n.tipo,
        "titulo": n.titulo,
        "texto": n.mensaje,
        "fecha": n.creada_en.isoformat(),
        "enlace": n.enlace or "/inicio",
        "leida": n.leida,
    }


@require_GET
@requiere_permiso(campana=False)
def avisos(request):
    desde = timezone.now() - timedelta(days=DIAS)
    propias = Notificacion.objects.filter(usuario=request.user, creada_en__gte=desde)
    return JsonResponse({
        "avisos": [_json(n) for n in propias.order_by("-creada_en")[:MAXIMO]],
        "sin_leer": propias.filter(leida=False).count(),
    })


@require_POST
@requiere_permiso(campana=False)
def marcar_leidas(request):
    """Al abrir la campanita, todos los avisos del usuario quedan leídos."""
    cantidad = Notificacion.objects.filter(usuario=request.user, leida=False).update(
        leida=True, leida_en=timezone.now()
    )
    return JsonResponse({"ok": True, "leidas": cantidad})


@require_http_methods(["GET", "PUT"])
@requiere_permiso(campana=False)
def preferencias(request):
    """Configuración → Notificaciones: qué avisos quiere recibir el usuario.
    GET: los tipos que le pueden llegar, con "recibir" sí/no.
    PUT {tipo: true/false, ...}: guarda lo elegido."""
    usuario = request.user
    tipos = tipos_de(usuario)
    if request.method == "PUT":
        datos = leer_json(request)
        if not isinstance(datos, dict) or not all(isinstance(v, bool) for v in datos.values()):
            return error("Los datos enviados no son válidos.")
        for tipo, recibir in datos.items():
            if tipo not in tipos:
                return error("Ese tipo de aviso no existe o no le corresponde.")
            PreferenciaNotificacion.objects.update_or_create(usuario=usuario, tipo=tipo, defaults={"recibir": recibir})
    no = set(
        PreferenciaNotificacion.objects.filter(usuario=usuario, recibir=False).values_list("tipo", flat=True)
    )
    return JsonResponse({
        "preferencias": [
            {"tipo": t.value, "nombre": t.label, "descripcion": DESCRIPCIONES[t], "recibir": t.value not in no}
            for t in tipos
        ]
    })
