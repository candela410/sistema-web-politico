"""Utilidades compartidas por las vistas de la API JSON."""

import json
from functools import wraps

from django.http import JsonResponse


def error(mensaje, status=400):
    return JsonResponse({"error": mensaje}, status=status)


def requiere_sesion(vista):
    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return error("No autenticado.", 401)
        return vista(request, *args, **kwargs)

    return envoltura


def leer_json(request):
    """Devuelve el cuerpo JSON como dict, o None si no es un objeto JSON válido."""
    try:
        datos = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None
    return datos if isinstance(datos, dict) else None
