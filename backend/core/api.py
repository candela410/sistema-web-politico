"""Utilidades compartidas por las vistas de la API JSON: errores, permisos de
Django y campaña activa."""

import json
from functools import wraps

from django.http import JsonResponse

from .models import Campana

SESION_CAMPANA = "campana_activa"


def error(mensaje, status=400, **extra):
    return JsonResponse({"error": mensaje, **extra}, status=status)


def leer_json(request):
    """Devuelve el cuerpo JSON como dict, o None si no es un objeto JSON válido."""
    try:
        datos = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None
    return datos if isinstance(datos, dict) else None


# ---------------------------------------------------------------------------
# Campaña activa
# ---------------------------------------------------------------------------


def puede_elegir_campana(usuario):
    """El superusuario y quien tenga el permiso "elegir_campana" eligen la
    campaña al ingresar. El resto trabaja siempre en la campaña de su usuario."""
    return usuario.is_superuser or usuario.has_perm("core.elegir_campana")


def campanas_disponibles(usuario):
    if puede_elegir_campana(usuario):
        return Campana.objects.filter(activa=True)
    return Campana.objects.filter(pk=usuario.campana_id, activa=True)


def campana_activa(request):
    usuario = request.user
    if not usuario.is_authenticated:
        return None
    if puede_elegir_campana(usuario):
        id_campana = request.session.get(SESION_CAMPANA)
        return Campana.objects.filter(pk=id_campana, activa=True).first() if id_campana else None
    return Campana.objects.filter(pk=usuario.campana_id, activa=True).first() if usuario.campana_id else None


# ---------------------------------------------------------------------------
# Decoradores
# ---------------------------------------------------------------------------


def requiere_sesion(vista):
    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return error("No autenticado.", 401)
        return vista(request, *args, **kwargs)

    return envoltura


def requiere_permiso(*permisos, campana=True):
    """Exige sesión, los permisos de Django indicados (por ejemplo
    "core.add_cuestionario") y, si campana=True, una campaña elegida, que
    queda en request.campana.

    Se puede pasar un dict {método HTTP: permiso} para pedir un permiso distinto
    según la acción (ver, crear, editar, borrar)."""

    def decorador(vista):
        @wraps(vista)
        def envoltura(request, *args, **kwargs):
            usuario = request.user
            if not usuario.is_authenticated:
                return error("No autenticado.", 401)
            necesarios = []
            for p in permisos:
                if isinstance(p, dict):
                    necesarios += [p[request.method]] if request.method in p else []
                else:
                    necesarios.append(p)
            if not usuario.has_perms(necesarios):
                return error("No tenés permiso para hacer esto.", 403)
            request.campana = campana_activa(request)
            if campana and request.campana is None:
                return error("Primero elegí una campaña.", 409, codigo="sin_campana")
            return vista(request, *args, **kwargs)

        return envoltura

    return decorador


def crud(modelo):
    """Permisos de Django de un modelo según el método: GET ver, POST crear,
    PATCH/PUT editar, DELETE borrar."""
    return {
        "GET": f"core.view_{modelo}",
        "POST": f"core.add_{modelo}",
        "PATCH": f"core.change_{modelo}",
        "PUT": f"core.change_{modelo}",
        "DELETE": f"core.delete_{modelo}",
    }
