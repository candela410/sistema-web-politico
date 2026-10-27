"""Campañas: elegir con cuál trabajar (superusuario o quien tenga permiso) y
administrarlas."""

from datetime import date

from django.db.models import Count, ProtectedError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import (
    SESION_CAMPANA,
    campanas_disponibles,
    crud,
    error,
    leer_json,
    puede_elegir_campana,
    requiere_permiso,
    requiere_sesion,
)
from .bitacora import diferencias, registrar
from .models import Campana
from .views import usuario_json


def _foto(c):
    return {
        "Nombre": c.nombre,
        "Descripción": c.descripcion or "",
        "Fecha de inicio": c.fecha_inicio,
        "Fecha de fin": c.fecha_fin,
        "Activa": "Sí" if c.activa else "No",
    }


def _campana_json(c):
    return {
        "id": c.pk,
        "nombre": c.nombre,
        "descripcion": c.descripcion or "",
        "fecha_inicio": c.fecha_inicio.isoformat() if c.fecha_inicio else None,
        "fecha_fin": c.fecha_fin.isoformat() if c.fecha_fin else None,
        "activa": c.activa,
        "cuestionarios": getattr(c, "n_cuestionarios", None),
        "usuarios": getattr(c, "n_usuarios", None),
        "zonas": getattr(c, "n_zonas", None),
    }


def _con_conteos(consulta):
    return consulta.annotate(
        n_cuestionarios=Count("cuestionarios", distinct=True),
        n_usuarios=Count("usuarios", distinct=True),
        n_zonas=Count("zonas", distinct=True),
    )


@require_http_methods(["GET"])
@requiere_sesion
def disponibles(request):
    """Campañas a las que puede entrar el usuario (pantalla "Elegí la campaña")."""
    lista = _con_conteos(campanas_disponibles(request.user)).order_by("nombre")
    return JsonResponse({"campanas": [_campana_json(c) for c in lista]})


@require_http_methods(["POST", "DELETE"])
@requiere_sesion
def activa(request):
    """POST {campana}: entra a esa campaña. DELETE: vuelve a la pantalla de elegir."""
    if not puede_elegir_campana(request.user):
        return error("No tenés permiso para cambiar de campaña.", 403)
    if request.method == "DELETE":
        request.session.pop(SESION_CAMPANA, None)
        return JsonResponse({"usuario": usuario_json(request)})
    datos = leer_json(request) or {}
    campana = campanas_disponibles(request.user).filter(pk=datos.get("campana")).first()
    if campana is None:
        return error("Esa campaña no existe o no está activa.")
    request.session[SESION_CAMPANA] = campana.pk
    return JsonResponse({"usuario": usuario_json(request)})


def _validar(datos, campana=None):
    nombre = datos.get("nombre", campana.nombre if campana else "")
    if not isinstance(nombre, str) or not nombre.strip():
        return None, "Poné un nombre a la campaña."
    nombre = nombre.strip()[:150]
    repetida = Campana.objects.filter(nombre__iexact=nombre)
    if campana:
        repetida = repetida.exclude(pk=campana.pk)
    if repetida.exists():
        return None, "Ya existe una campaña con ese nombre."
    fechas = {}
    for campo in ("fecha_inicio", "fecha_fin"):
        valor = datos.get(campo, getattr(campana, campo) if campana else None)
        if isinstance(valor, str):
            if not valor:
                valor = None
            else:
                try:
                    valor = date.fromisoformat(valor)
                except ValueError:
                    return None, "Las fechas deben tener el formato AAAA-MM-DD."
        fechas[campo] = valor
    if fechas["fecha_inicio"] and fechas["fecha_fin"] and fechas["fecha_fin"] < fechas["fecha_inicio"]:
        return None, "La fecha de fin no puede ser anterior a la de inicio."
    activa_ = datos.get("activa", campana.activa if campana else True)
    if not isinstance(activa_, bool):
        return None, "El estado debe ser verdadero o falso."
    descripcion = datos.get("descripcion", campana.descripcion if campana else "") or ""
    return {
        "nombre": nombre,
        "descripcion": str(descripcion).strip() or None,
        "activa": activa_,
        **fechas,
    }, None


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("campana"), campana=False)
def campanas(request):
    if request.method == "GET":
        lista = _con_conteos(Campana.objects.all())
        return JsonResponse({"campanas": [_campana_json(c) for c in lista]})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    limpios, mensaje = _validar(datos)
    if mensaje:
        return error(mensaje)
    campana = Campana.objects.create(**limpios)
    registrar(request, campana, "crear", campana=campana, detalle=f"Creó la campaña {campana.nombre}")
    return JsonResponse({"campana": _campana_json(campana)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("campana"), campana=False)
def campana_detalle(request, pk):
    campana = get_object_or_404(Campana, pk=pk)
    if request.method == "DELETE":
        try:
            campana.delete()
        except ProtectedError:
            return error(
                "No se puede borrar: la campaña tiene datos (usuarios, zonas, cuestionarios o rutas). Podés desactivarla.",
                409,
            )
        registrar(request, campana, "borrar", campana=None, detalle=f"Borró la campaña {campana.nombre}")
        return JsonResponse({"ok": True})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    limpios, mensaje = _validar(datos, campana)
    if mensaje:
        return error(mensaje)
    antes = _foto(campana)
    for campo, valor in limpios.items():
        setattr(campana, campo, valor)
    campana.save()
    cambios = diferencias(antes, _foto(campana))
    if cambios:
        registrar(request, campana, "editar", cambios=cambios, campana=campana)
    return JsonResponse({"campana": _campana_json(campana)})
