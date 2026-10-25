"""Utilidades compartidas por las vistas de la API JSON."""

import json
from functools import wraps

from django.http import JsonResponse

from .models import Campana


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


def campana_de(usuario):
    """La campaña del usuario; si no tiene, la primera activa (o se crea una)."""
    if usuario.campana_id:
        return usuario.campana
    campana = Campana.objects.filter(activa=True).order_by("id_campana").first()
    return campana or Campana.objects.create(nombre="Campaña principal")
