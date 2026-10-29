"""API de equipos: listar, crear, editar, activar/desactivar y borrar.

Un equipo tiene id, nombre, la ruta que recorre y sus usuarios. Reglas:
- No se puede crear (ni editar) un equipo sin ruta.
- Todo equipo tiene ruta, así que no se borra: se desactiva (y se puede
  volver a activar).
- Un usuario pertenece a un equipo por su campo equipo (usuarios.id_equipo).
  Solo se pueden asignar usuarios de la campaña, activos, con el rol
  Militantes y que no estén en otro equipo.
Los equipos no guardan campaña (como en el DER): la campaña de un equipo sale
de sus usuarios. Una campaña ve los equipos que tienen usuarios suyos y los que
todavía no tienen usuarios.
"""

from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, registrar
from .mapa_views import rutas_de_campana
from .models import Equipo, Usuario
from .usuarios_views import GRUPO_MILITANTES

ORDEN_USUARIOS = ("first_name", "last_name", "email")


def _nombre(usuario):
    return usuario.get_full_name().strip() or usuario.email


def _usuario_json(usuario):
    return {"id": usuario.pk, "nombre": _nombre(usuario), "email": usuario.email}


def equipos_de_campana(campana):
    """Equipos que ve una campaña: los que tienen usuarios de esa campaña y los
    que todavía no tienen usuarios.

    SQL equivalente:
        SELECT DISTINCT e.* FROM equipos e
        LEFT JOIN usuarios u ON u.id_equipo = e.id_equipo
        WHERE u.id_campana = %s OR u.id IS NULL
    """
    return Equipo.objects.filter(Q(usuarios__campana=campana) | Q(usuarios__isnull=True)).distinct()


def _miembros(ids_equipos):
    """{id_equipo: [usuarios]} de los usuarios de esos equipos."""
    usuarios = Usuario.objects.filter(equipo_id__in=ids_equipos).order_by(*ORDEN_USUARIOS)
    por_equipo = {}
    for u in usuarios:
        por_equipo.setdefault(u.equipo_id, []).append(_usuario_json(u))
    return por_equipo


def _disponibles(request):
    """Usuarios que se pueden asignar: de la campaña, activos, con el rol
    Militantes y sin equipo."""
    lista = Usuario.objects.filter(
        campana=request.campana,
        is_active=True,
        groups__name=GRUPO_MILITANTES,
        equipo__isnull=True,
    ).distinct().order_by(*ORDEN_USUARIOS)
    return [_usuario_json(u) for u in lista]


def _equipo_json(equipo, usuarios):
    return {
        "id": equipo.pk,
        "nombre": equipo.nombre,
        "ruta": equipo.ruta_id,
        "ruta_nombre": equipo.ruta.nombre if equipo.ruta_id else None,
        "activo": equipo.activo,
        "usuarios": usuarios,
    }


def _foto(equipo):
    usuarios = [u["nombre"] for u in _miembros([equipo.pk]).get(equipo.pk, [])]
    return {
        "Nombre": equipo.nombre,
        "Ruta": equipo.ruta.nombre if equipo.ruta_id else "Sin ruta",
        "Activo": "Sí" if equipo.activo else "No",
        "Usuarios": ", ".join(sorted(usuarios)) or "Ninguno",
    }


def _validar(request, datos, equipo=None):
    """Valida nombre y ruta. Devuelve (nombre, ruta, mensaje). La ruta es obligatoria."""
    nombre = datos.get("nombre", equipo.nombre if equipo else "")
    if not isinstance(nombre, str) or not nombre.strip():
        return None, None, "Poné un nombre al equipo."
    nombre = nombre.strip()
    if len(nombre) > 120:
        return None, None, "El nombre es muy largo (máximo 120 caracteres)."

    repetido = Equipo.objects.filter(nombre__iexact=nombre)
    if equipo:
        repetido = repetido.exclude(pk=equipo.pk)
    if repetido.exists():
        return None, None, "Ya existe un equipo con ese nombre."

    # Si no viene "ruta" en la edición, se conserva la que ya tenía
    id_ruta = datos.get("ruta", equipo.ruta_id if equipo else None)
    if id_ruta in (None, ""):
        return None, None, "Elegí la ruta del equipo."
    if isinstance(id_ruta, bool) or not isinstance(id_ruta, int):
        return None, None, "La ruta no es válida."
    ruta = rutas_de_campana(request.campana).filter(pk=id_ruta).first()
    if ruta is None:
        return None, None, "La ruta elegida no existe."
    return nombre, ruta, None


def _validar_usuarios(request, datos, equipo=None):
    """Devuelve (ids, mensaje). ids es None si "usuarios" no viene en los datos
    (en ese caso no se tocan los usuarios del equipo)."""
    ids = datos.get("usuarios")
    if ids is None:
        return None, None
    if not isinstance(ids, list) or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
        return None, "La lista de usuarios no es válida."
    ids = set(ids)

    usuarios = list(
        Usuario.objects.filter(pk__in=ids, campana=request.campana, groups__name=GRUPO_MILITANTES).distinct()
    )
    if len(usuarios) != len(ids):
        return None, "Alguno de los usuarios no existe o no es militante."

    for u in usuarios:
        ya_es_del_equipo = equipo is not None and u.equipo_id == equipo.pk
        if u.equipo_id and not ya_es_del_equipo:
            return None, f"{_nombre(u)} ya está en otro equipo."
        if not ya_es_del_equipo and not u.is_active:
            return None, f"{_nombre(u)} no está activo."
    return ids, None


def _asignar_usuarios(equipo, ids):
    """Deja en el equipo exactamente a esos usuarios."""
    Usuario.objects.filter(equipo=equipo).exclude(pk__in=ids).update(equipo=None)
    Usuario.objects.filter(pk__in=ids).update(equipo=equipo)


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("equipo"))
def equipos(request):
    if request.method == "GET":
        lista = list(equipos_de_campana(request.campana).select_related("ruta").order_by("nombre"))
        miembros = _miembros([e.pk for e in lista])
        # Se mandan también las rutas de la campaña y los usuarios sin equipo
        # para los selectores del formulario.
        rutas = rutas_de_campana(request.campana).order_by("nombre")
        return JsonResponse(
            {
                "equipos": [_equipo_json(e, miembros.get(e.pk, [])) for e in lista],
                "rutas": [{"id": r.pk, "nombre": r.nombre} for r in rutas],
                "usuarios_disponibles": _disponibles(request),
            }
        )

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    nombre, ruta, mensaje = _validar(request, datos)
    if mensaje:
        return error(mensaje)
    ids, mensaje = _validar_usuarios(request, datos)
    if mensaje:
        return error(mensaje)
    with transaction.atomic():
        equipo = Equipo.objects.create(nombre=nombre, ruta=ruta)
        if ids:
            _asignar_usuarios(equipo, ids)
    registrar(request, equipo, "crear", detalle=f"Creó el equipo {equipo.nombre}")
    return JsonResponse({"equipo": _equipo_json(equipo, _miembros([equipo.pk]).get(equipo.pk, []))}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("equipo"))
def equipo_detalle(request, pk):
    equipo = get_object_or_404(equipos_de_campana(request.campana).select_related("ruta"), pk=pk)

    if request.method == "DELETE":
        # La ruta es obligatoria, así que ningún equipo se borra: se desactiva
        return error("No se puede borrar un equipo que tiene una ruta asignada. Desactivalo.", 409)

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")

    activo = datos.get("activo", equipo.activo)
    if not isinstance(activo, bool):
        return error("El estado debe ser verdadero o falso.")

    nombre = ruta = None
    if "nombre" in datos or "ruta" in datos:
        nombre, ruta, mensaje = _validar(request, datos, equipo)
        if mensaje:
            return error(mensaje)
    ids, mensaje = _validar_usuarios(request, datos, equipo)
    if mensaje:
        return error(mensaje)
    if activo and not (ruta.pk if ruta else equipo.ruta_id):
        return error("Asignale una ruta al equipo antes de activarlo.")

    antes = _foto(equipo)
    with transaction.atomic():
        if nombre is not None:
            equipo.nombre = nombre
            equipo.ruta = ruta
        equipo.activo = activo
        equipo.save()
        # Si "usuarios" no viene (por ejemplo al activar o desactivar) se conservan
        if ids is not None:
            _asignar_usuarios(equipo, ids)

    despues = _foto(equipo)
    cambios = diferencias(antes, despues)
    if cambios:
        detalle = ""
        if antes["Activo"] != despues["Activo"]:
            detalle = f"{'Activó' if equipo.activo else 'Desactivó'} el equipo {equipo.nombre}"
        registrar(request, equipo, "editar", cambios=cambios, detalle=detalle)
    return JsonResponse({"equipo": _equipo_json(equipo, _miembros([equipo.pk]).get(equipo.pk, []))})