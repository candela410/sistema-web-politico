"""Avisos de la campanita (barra superior).

Lee las notificaciones del usuario de la tabla notificaciones (las crea
core/notificaciones.py cuando pasa algo). Lo leído queda guardado en la base,
así no vuelven a aparecer como nuevas en otra computadora.
"""

from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .api import requiere_permiso
from .models import Notificacion

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
