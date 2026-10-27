"""API para listar los permisos que se pueden asignar a un grupo."""

from django.contrib.auth.models import Permission
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .api import requiere_admin

# Acción de Django -> texto que se muestra (mismo orden que en Permisos.jsx)
ACCIONES = {"view": "Ver", "add": "Crear", "change": "Editar", "delete": "Borrar"}


def permisos_disponibles():
    """Permisos de la app core agrupados por sección (modelo)."""
    permisos = (
        Permission.objects.filter(content_type__app_label="core")
        .select_related("content_type")
        .order_by("content_type__model", "codename")
    )
    secciones = {}
    for permiso in permisos:
        modelo = permiso.content_type.model_class()
        clave = permiso.content_type.model
        nombre = (
            str(modelo._meta.verbose_name_plural).capitalize()
            if modelo
            else clave.capitalize()
        )
        accion = permiso.codename.split("_", 1)[0]
        etiqueta = ACCIONES.get(accion) if permiso.codename == f"{accion}_{clave}" else None
        secciones.setdefault(clave, {"seccion": nombre, "permisos": []})
        secciones[clave]["permisos"].append(
            {
                "id": permiso.pk,
                "codigo": permiso.codename,
                "accion": etiqueta or permiso.name,
            }
        )
    return sorted(secciones.values(), key=lambda s: s["seccion"])


@require_GET
@requiere_admin
def permisos(request):
    return JsonResponse({"secciones": permisos_disponibles()})