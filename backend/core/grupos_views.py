
"""API para listar, crear, editar y borrar grupos."""

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import error, leer_json, requiere_admin
from .models import Grupo


def grupo_json(grupo):
    return {
        "id": grupo.id_grupo,
        "nombre": grupo.nombre,
    }


def validar_nombre(nombre, grupo=None):
    if not isinstance(nombre, str) or not nombre.strip():
        return "Ingresá el nombre del grupo."

    nombre = nombre.strip()

    if len(nombre) > 120:
        return "El nombre no puede superar los 120 caracteres."

    repetido = Grupo.objects.filter(nombre__iexact=nombre)

    if grupo:
        repetido = repetido.exclude(pk=grupo.pk)

    if repetido.exists():
        return "Ya existe un grupo con ese nombre."

    return None


@require_http_methods(["GET", "POST"])
@requiere_admin
def grupos(request):
    if request.method == "GET":
        lista = Grupo.objects.all().order_by("nombre")
        return JsonResponse({
            "grupos": [grupo_json(g) for g in lista]
        })

    datos = leer_json(request)

    if datos is None:
        return error("JSON inválido.")

    mensaje = validar_nombre(datos.get("nombre"))

    if mensaje:
        return error(mensaje)

    grupo = Grupo.objects.create(
        nombre=datos["nombre"].strip()
    )

    return JsonResponse(
        {"grupo": grupo_json(grupo)},
        status=201
    )


@require_http_methods(["PATCH", "DELETE"])
@requiere_admin
def grupo_detalle(request, pk):
    grupo = get_object_or_404(Grupo, pk=pk)

    if request.method == "DELETE":
        grupo.delete()
        return JsonResponse({"ok": True})

    datos = leer_json(request)

    if datos is None:
        return error("JSON inválido.")

    mensaje = validar_nombre(
        datos.get("nombre", grupo.nombre),
        grupo
    )

    if mensaje:
        return error(mensaje)

    grupo.nombre = datos.get("nombre", grupo.nombre).strip()
    grupo.save()

    return JsonResponse({
        "grupo": grupo_json(grupo)
    })
