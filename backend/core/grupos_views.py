"""API para listar, crear, editar y borrar grupos (con descripción y permisos)."""

from django.contrib.auth.models import Permission
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .models import Grupo


def grupo_json(grupo):
    return {
        "id": grupo.id_grupo,
        "nombre": grupo.nombre,
        "descripcion": grupo.descripcion,
        "permisos": sorted(grupo.permisos.values_list("id", flat=True)),
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


def validar_descripcion(descripcion):
    if descripcion is None:
        return None
    if not isinstance(descripcion, str):
        return "La descripción no es válida."
    if len(descripcion.strip()) > 500:
        return "La descripción no puede superar los 500 caracteres."
    return None


def validar_permisos(ids):
    """Devuelve (permisos, mensaje). Solo se aceptan permisos de la app core."""
    if ids is None:
        return None, None
    if not isinstance(ids, list) or not all(
        isinstance(i, int) and not isinstance(i, bool) for i in ids
    ):
        return None, "La lista de permisos no es válida."

    ids = set(ids)
    permisos = Permission.objects.filter(pk__in=ids, content_type__app_label="core")

    if permisos.count() != len(ids):
        return None, "Alguno de los permisos elegidos no existe."

    return list(permisos), None


@require_http_methods(["GET", "POST"])
# Los grupos son de todo el sistema, no de una campaña
@requiere_permiso(crud("grupo"), campana=False)
def grupos(request):
    if request.method == "GET":
        lista = Grupo.objects.prefetch_related("permisos").order_by("nombre")
        return JsonResponse({"grupos": [grupo_json(g) for g in lista]})

    datos = leer_json(request)

    if datos is None:
        return error("JSON inválido.")

    mensaje = validar_nombre(datos.get("nombre")) or validar_descripcion(
        datos.get("descripcion")
    )
    permisos, mensaje_permisos = validar_permisos(datos.get("permisos"))
    mensaje = mensaje or mensaje_permisos

    if mensaje:
        return error(mensaje)

    grupo = Grupo.objects.create(
        nombre=datos["nombre"].strip(),
        descripcion=(datos.get("descripcion") or "").strip(),
    )

    if permisos:
        grupo.permisos.set(permisos)

    return JsonResponse({"grupo": grupo_json(grupo)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("grupo"), campana=False)
def grupo_detalle(request, pk):
    grupo = get_object_or_404(Grupo, pk=pk)

    if request.method == "DELETE":
        grupo.delete()
        return JsonResponse({"ok": True})

    datos = leer_json(request)

    if datos is None:
        return error("JSON inválido.")

    mensaje = validar_nombre(datos.get("nombre", grupo.nombre), grupo)
    mensaje = mensaje or validar_descripcion(datos.get("descripcion"))
    permisos, mensaje_permisos = validar_permisos(datos.get("permisos"))
    mensaje = mensaje or mensaje_permisos

    if mensaje:
        return error(mensaje)

    grupo.nombre = datos.get("nombre", grupo.nombre).strip()

    if datos.get("descripcion") is not None:
        grupo.descripcion = datos["descripcion"].strip()

    grupo.save()

    if permisos is not None:
        grupo.permisos.set(permisos)

    return JsonResponse({"grupo": grupo_json(grupo)})