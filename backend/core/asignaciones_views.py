"""Asignación de cuestionarios a militantes.

La tabla usuariosxcuestionarios guarda una fila por usuario (id_usuario,
id_cuestionario). En la pantalla se eligen equipos completos o personas
sueltas, pero lo que se guarda siempre es usuario por usuario:
- Si alguien entra a un equipo después, no recibe el cuestionario solo.
- Quitar una asignación la borra (eliminación física): las encuestas que ya
  cargó esa persona no se pierden, porque apuntan al cuestionario y al
  usuario, no a la asignación. Cada cambio queda en el historial.
"""

from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import error, leer_json, requiere_permiso
from .bitacora import registrar
from .models import AsignacionCuestionario, Cuestionario, Equipo, Usuario
from .usuarios_views import GRUPO_MILITANTES

PERMISOS = {
    "GET": "core.view_asignacioncuestionario",
    "PUT": "core.change_asignacioncuestionario",
}


def _nombre(usuario):
    return usuario.get_full_name().strip() or usuario.email


def _militantes(campana):
    """Usuarios que se pueden asignar: de la campaña, activos y con el rol Militantes."""
    return Usuario.objects.filter(campana=campana, is_active=True, groups__name=GRUPO_MILITANTES).distinct()


def _asignados(cuestionario):
    return set(AsignacionCuestionario.objects.filter(cuestionario=cuestionario).values_list("usuario_id", flat=True))


def _usuario_json(u, asignados, elegible=True):
    return {
        "id": u.pk,
        "nombre": _nombre(u),
        "email": u.email,
        "asignado": u.pk in asignados,
        # Asignado de antes pero ya no es militante activo: solo se puede quitar
        "elegible": elegible,
    }


@require_http_methods(["GET", "PUT"])
@requiere_permiso(PERMISOS)
def asignaciones(request, pk):
    cuestionario = get_object_or_404(
        Cuestionario.objects.select_related("categoria"), pk=pk, campana=request.campana
    )
    if request.method == "GET":
        return JsonResponse(_respuesta(request, cuestionario))

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    ids = datos.get("usuarios")
    if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
        return error("La lista de usuarios no es válida.")
    elegidos = set(ids)
    antes = _asignados(cuestionario)

    nuevos = elegidos - antes
    if nuevos:
        validos = set(_militantes(request.campana).filter(pk__in=nuevos).values_list("pk", flat=True))
        if validos != nuevos:
            return error("Alguno de los usuarios no existe, no está activo o no es militante de la campaña.")
    quitados = antes - elegidos

    if nuevos or quitados:
        with transaction.atomic():
            AsignacionCuestionario.objects.filter(cuestionario=cuestionario, usuario_id__in=quitados).delete()
            AsignacionCuestionario.objects.bulk_create(
                [AsignacionCuestionario(cuestionario=cuestionario, usuario_id=i) for i in nuevos]
            )
        nombres = {u.pk: _nombre(u) for u in Usuario.objects.filter(pk__in=antes | elegidos)}
        lista = lambda ids_: ", ".join(sorted(nombres[i] for i in ids_)) or "Nadie"
        partes = []
        if nuevos:
            partes.append(f"asignó a {len(nuevos)} usuario(s)")
        if quitados:
            partes.append(f"quitó a {len(quitados)} usuario(s)")
        registrar(
            request, cuestionario, "editar",
            cambios=[{"campo": "Asignado a", "antes": lista(antes), "despues": lista(elegidos)}],
            detalle=f"En el cuestionario {cuestionario.titulo} " + " y ".join(partes),
        )
    return JsonResponse(_respuesta(request, cuestionario))


def _respuesta(request, cuestionario):
    """Datos del cuestionario, los equipos con sus militantes y los militantes sin equipo."""
    asignados = _asignados(cuestionario)
    militantes = list(_militantes(request.campana).order_by("first_name", "last_name", "email"))
    ids_militantes = {u.pk for u in militantes}
    # Los que siguen asignados pero ya no son militantes activos se muestran para poder quitarlos
    viejos = list(
        Usuario.objects.filter(pk__in=asignados - ids_militantes).order_by("first_name", "last_name", "email")
    )

    equipos = list(Equipo.objects.filter(campana=request.campana).order_by("nombre"))
    por_equipo = {e.pk: [] for e in equipos}
    sin_equipo = []
    for u, elegible in [(u, True) for u in militantes] + [(u, False) for u in viejos]:
        destino = por_equipo.get(u.equipo_id, sin_equipo)
        destino.append(_usuario_json(u, asignados, elegible))

    return {
        "cuestionario": {
            "id": cuestionario.pk,
            "titulo": cuestionario.titulo,
            "descripcion": cuestionario.descripcion or "",
            "categoria": cuestionario.categoria.nombre,
            "activo": cuestionario.activo,
            "preguntas": cuestionario.preguntas.count(),
        },
        "equipos": [
            {"id": e.pk, "nombre": e.nombre, "activo": e.activo, "usuarios": por_equipo[e.pk]}
            for e in equipos
            if por_equipo[e.pk]
        ],
        "sin_equipo": sin_equipo,
        "asignados": len(asignados),
    }
