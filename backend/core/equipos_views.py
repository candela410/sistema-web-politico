"""API de equipos: listar, crear, editar, activar/desactivar y borrar.

Un equipo tiene id, nombre, la ruta que recorre y sus usuarios. Reglas:
- No se puede crear (ni editar) un equipo sin ruta.
- Un equipo con ruta no se borra: se desactiva (y se puede volver a activar).
- Solo se pueden borrar equipos sin ruta (los que quedaron así, por ejemplo,
  al borrar su ruta).
- Un usuario pertenece a un equipo a través de su ficha de militante
  (Militante.usuario → Militante.equipo). Solo se pueden asignar usuarios de la
  campaña, activos, con ficha de militante y que no estén en otro equipo.
Los equipos y las rutas pertenecen a una campaña: solo se ven y se usan los de
la campaña activa.
"""

from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, registrar
from .models import Equipo, Militante, Ruta, Usuario

ORDEN_USUARIOS = ("usuario__first_name", "usuario__last_name", "usuario__email")


def _nombre(usuario):
    return usuario.get_full_name().strip() or usuario.email


def _usuario_json(usuario):
    return {"id": usuario.pk, "nombre": _nombre(usuario), "email": usuario.email}


def _miembros(ids_equipos):
    """{id_equipo: [usuarios]} de los militantes con usuario de esos equipos."""
    militantes = (
        Militante.objects.filter(equipo_id__in=ids_equipos, usuario__isnull=False)
        .select_related("usuario")
        .order_by(*ORDEN_USUARIOS)
    )
    por_equipo = {}
    for m in militantes:
        por_equipo.setdefault(m.equipo_id, []).append(_usuario_json(m.usuario))
    return por_equipo


def _disponibles(request):
    """Usuarios que se pueden asignar: de la campaña, activos, con ficha de
    militante activa y sin equipo."""
    lista = Usuario.objects.filter(
        campana=request.campana,
        is_active=True,
        militante__isnull=False,
        militante__activo=True,
        militante__equipo__isnull=True,
    ).order_by("first_name", "last_name", "email")
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

    repetido = Equipo.objects.filter(campana=request.campana, nombre__iexact=nombre)
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
    ruta = Ruta.objects.filter(pk=id_ruta, campana=request.campana).first()
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

    militantes = Militante.objects.filter(usuario_id__in=ids, usuario__campana=request.campana).select_related(
        "usuario"
    )
    militantes = list(militantes)
    if len(militantes) != len(ids):
        return None, "Alguno de los usuarios no existe o no es militante."

    for m in militantes:
        ya_es_del_equipo = equipo is not None and m.equipo_id == equipo.pk
        if m.equipo_id and not ya_es_del_equipo:
            return None, f"{_nombre(m.usuario)} ya está en otro equipo."
        if not ya_es_del_equipo and not (m.usuario.is_active and m.activo):
            return None, f"{_nombre(m.usuario)} no está activo."
    return ids, None


def _asignar_usuarios(equipo, ids):
    """Deja en el equipo exactamente a esos usuarios. Los militantes del equipo
    que no tienen usuario no se tocan."""
    Militante.objects.filter(equipo=equipo, usuario__isnull=False).exclude(usuario_id__in=ids).update(equipo=None)
    Militante.objects.filter(usuario_id__in=ids).update(equipo=equipo)


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("equipo"))
def equipos(request):
    if request.method == "GET":
        lista = list(Equipo.objects.filter(campana=request.campana).select_related("ruta").order_by("nombre"))
        miembros = _miembros([e.pk for e in lista])
        # Se mandan también las rutas de la campaña y los usuarios sin equipo
        # para los selectores del formulario.
        rutas = Ruta.objects.filter(campana=request.campana).order_by("nombre")
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
        equipo = Equipo.objects.create(campana=request.campana, nombre=nombre, ruta=ruta)
        if ids:
            _asignar_usuarios(equipo, ids)
    registrar(request, equipo, "crear", detalle=f"Creó el equipo {equipo.nombre}")
    return JsonResponse({"equipo": _equipo_json(equipo, _miembros([equipo.pk]).get(equipo.pk, []))}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("equipo"))
def equipo_detalle(request, pk):
    equipo = get_object_or_404(Equipo.objects.select_related("ruta"), pk=pk, campana=request.campana)

    if request.method == "DELETE":
        if equipo.ruta_id:
            return error(
                "No se puede borrar un equipo que tiene una ruta asignada. Desactivalo.",
                409,
            )
        # Los militantes del equipo quedan sin equipo (SET_NULL)
        equipo.delete()
        registrar(request, equipo, "borrar", detalle=f"Borró el equipo {equipo.nombre}")
        return JsonResponse({"ok": True})

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