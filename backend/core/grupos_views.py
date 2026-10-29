"""API para listar, crear, editar y borrar grupos (roles), con sus permisos e
integrantes.

Los grupos son solo los de Django (tabla auth_group), los mismos que se
asignan en Gestión → Usuarios: lo que se le asigna a un usuario allá se ve
acá, y los permisos que se marcan acá (auth_group_permissions) son los que de
verdad tiene ese usuario.
"""

from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .models import Usuario

# Grupo que el sistema usa por nombre (ver usuarios_views.GRUPO_MILITANTES)
GRUPO_MILITANTES = "Militantes"


def _integrantes(group, campana):
    """Usuarios del grupo. Los usuarios son de una campaña: se muestran los de la
    campaña activa (o todos si no hay una elegida)."""
    usuarios = group.user_set.all()
    if campana is not None:
        usuarios = usuarios.filter(campana=campana)
    return [
        {
            "id": u.pk,
            "nombre": f"{u.first_name} {u.last_name}".strip() or u.email,
            "email": u.email,
            "activo": u.is_active,
        }
        for u in usuarios.order_by("-is_active", "first_name", "last_name", "email")
    ]


def grupo_json(group, campana=None):
    return {
        "id": group.pk,
        "nombre": group.name,
        "permisos": sorted(p.pk for p in group.permissions.all() if p.content_type.app_label == "core"),
        "usuarios": _integrantes(group, campana),
    }


def validar_nombre(nombre, group=None):
    if not isinstance(nombre, str) or not nombre.strip():
        return "Ingresá el nombre del grupo."

    nombre = nombre.strip()

    if len(nombre) > 120:
        return "El nombre no puede superar los 120 caracteres."

    repetido = Group.objects.filter(name__iexact=nombre)

    if group:
        repetido = repetido.exclude(pk=group.pk)

    if repetido.exists():
        return "Ya existe un grupo con ese nombre."

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


def _asignar_permisos(group, permisos):
    # Los permisos que no son de core (por ejemplo los de ver historial) no se
    # editan desde esta pantalla: se conservan.
    otros = list(group.permissions.exclude(content_type__app_label="core"))
    group.permissions.set(permisos + otros)


@require_http_methods(["GET", "POST"])
# Los grupos son de todo el sistema, no de una campaña
@requiere_permiso(crud("grupo"), campana=False)
def grupos(request):
    if request.method == "GET":
        lista = (
            Group.objects.prefetch_related("permissions__content_type")
            .order_by("name")
        )
        return JsonResponse({"grupos": [grupo_json(g, request.campana) for g in lista]})

    datos = leer_json(request)

    if datos is None:
        return error("JSON inválido.")

    mensaje = validar_nombre(datos.get("nombre"))
    permisos, mensaje_permisos = validar_permisos(datos.get("permisos"))
    mensaje = mensaje or mensaje_permisos

    if mensaje:
        return error(mensaje)

    with transaction.atomic():
        group = Group.objects.create(name=datos["nombre"].strip())
        if permisos:
            _asignar_permisos(group, permisos)

    return JsonResponse({"grupo": grupo_json(group, request.campana)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("grupo"), campana=False)
def grupo_detalle(request, pk):
    group = get_object_or_404(Group, pk=pk)

    if request.method == "DELETE":
        if group.name == GRUPO_MILITANTES:
            return error("El grupo Militantes lo usa el sistema y no se puede borrar.", 409)
        cantidad = group.user_set.count()
        if cantidad:
            return error(
                f"No se puede borrar: tiene {cantidad} usuario(s). Sacalos del grupo primero (Gestión → Usuarios).",
                409,
            )
        group.delete()
        return JsonResponse({"ok": True})

    datos = leer_json(request)

    if datos is None:
        return error("JSON inválido.")

    nombre = datos.get("nombre", group.name)
    if group.name == GRUPO_MILITANTES and isinstance(nombre, str) and nombre.strip() != group.name:
        return error("El grupo Militantes lo usa el sistema y no se puede renombrar.", 409)

    mensaje = validar_nombre(nombre, group)
    permisos, mensaje_permisos = validar_permisos(datos.get("permisos"))
    mensaje = mensaje or mensaje_permisos

    if mensaje:
        return error(mensaje)

    with transaction.atomic():
        group.name = nombre.strip()
        group.save()
        if permisos is not None:
            _asignar_permisos(group, permisos)

    group = Group.objects.prefetch_related("permissions__content_type").get(pk=group.pk)
    return JsonResponse({"grupo": grupo_json(group, request.campana)})