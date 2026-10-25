"""API del mapa: barrios y calles (solo lectura), zonas y rutas (crear,
editar y borrar). Todo en GeoJSON. Requiere sesión iniciada."""

import re

from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import error as _error
from .api import leer_json as _leer_json
from .api import requiere_sesion
from .geo import ErrorRuteo, calcular_ruta, centro, es_poligono_valido, punto_en_poligono
from .models import Barrio, Calle, Campana, Ruta, Zona

COLOR_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
MAX_PARADAS = 50  # límite de puntos por pedido de OpenRouteService


def _feature(geometria, propiedades):
    return {"type": "Feature", "geometry": geometria, "properties": propiedades}


def _coleccion(features):
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# Barrios y calles
# ---------------------------------------------------------------------------


def _barrio_props(barrio):
    return {
        "id": barrio.pk,
        "nombre": barrio.nombre,
        "zona": barrio.zona_id,
        "calles": getattr(barrio, "cantidad_calles", None),
    }


@require_http_methods(["GET"])
@requiere_sesion
def barrios(request):
    lista = Barrio.objects.annotate(cantidad_calles=Count("calles")).order_by("nombre")
    return JsonResponse(
        _coleccion([_feature(b.geometria, _barrio_props(b)) for b in lista if b.geometria])
        | {"sin_geometria": sum(1 for b in lista if not b.geometria)}
    )


@require_http_methods(["GET"])
@requiere_sesion
def calles(request):
    consulta = Calle.objects.select_related("barrio")
    if request.GET.get("barrio"):
        consulta = consulta.filter(barrio_id=request.GET["barrio"])
    elif request.GET.get("zona"):
        consulta = consulta.filter(barrio__zona_id=request.GET["zona"])
    else:
        return _error("Indicá ?barrio=ID o ?zona=ID.")
    return JsonResponse(
        _coleccion([
            _feature(c.geometria, {"id": c.pk, "nombre": c.nombre, "barrio": c.barrio.nombre})
            for c in consulta.order_by("nombre")
            if c.geometria
        ])
    )


# ---------------------------------------------------------------------------
# Zonas
# ---------------------------------------------------------------------------


def _zona_json(zona):
    barrios_zona = list(zona.barrios.order_by("nombre").values("id_barrio", "nombre"))
    return {
        "id": zona.pk,
        "nombre": zona.nombre,
        "color": zona.color or "#51318f",
        "geometria": zona.geometria,
        "barrios": [{"id": b["id_barrio"], "nombre": b["nombre"]} for b in barrios_zona],
    }


def _asignar_barrios(zona):
    """Asigna a la zona los barrios cuyo centro cae dentro de su polígono.

    No le quita barrios a otras zonas: si un barrio ya tiene zona, se mantiene.
    """
    Barrio.objects.filter(zona=zona).update(zona=None)
    ids = []
    for barrio in Barrio.objects.filter(zona__isnull=True).exclude(geometria=None):
        punto = centro(barrio.geometria)
        if punto and punto_en_poligono(punto[0], punto[1], zona.geometria):
            ids.append(barrio.pk)
    Barrio.objects.filter(pk__in=ids).update(zona=zona)


def _validar_zona(datos, zona=None):
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return "Poné un nombre a la zona."
    if len(nombre) > 100:
        return "El nombre es muy largo (máximo 100 caracteres)."
    repetida = Zona.objects.filter(nombre__iexact=nombre)
    if zona:
        repetida = repetida.exclude(pk=zona.pk)
    if repetida.exists():
        return "Ya existe una zona con ese nombre."
    if datos.get("color") and not COLOR_HEX.match(datos["color"]):
        return "El color debe tener el formato #RRGGBB."
    if "geometria" in datos and not es_poligono_valido(datos["geometria"]):
        return "Dibujá la zona como un polígono en el mapa."
    return None


@require_http_methods(["GET", "POST"])
@requiere_sesion
def zonas(request):
    if request.method == "GET":
        return JsonResponse({"zonas": [_zona_json(z) for z in Zona.objects.order_by("nombre")]})

    datos = _leer_json(request)
    if datos is None:
        return _error("JSON inválido.")
    if "geometria" not in datos:
        return _error("Dibujá la zona como un polígono en el mapa.")
    error = _validar_zona(datos)
    if error:
        return _error(error)
    with transaction.atomic():
        zona = Zona.objects.create(
            nombre=datos["nombre"].strip(),
            color=datos.get("color") or "#51318f",
            geometria=datos["geometria"],
        )
        _asignar_barrios(zona)
    return JsonResponse({"zona": _zona_json(zona)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_sesion
def zona_detalle(request, pk):
    zona = get_object_or_404(Zona, pk=pk)
    if request.method == "DELETE":
        if zona.rutas.exists():
            return _error("La zona tiene rutas asignadas. Borralas o movelas primero.", 409)
        with transaction.atomic():
            zona.barrios.update(zona=None)
            zona.delete()
        return JsonResponse({"ok": True})

    datos = _leer_json(request)
    if datos is None:
        return _error("JSON inválido.")
    datos.setdefault("nombre", zona.nombre)
    error = _validar_zona(datos, zona)
    if error:
        return _error(error)
    with transaction.atomic():
        zona.nombre = datos["nombre"].strip()
        zona.color = datos.get("color") or zona.color
        if "geometria" in datos:
            zona.geometria = datos["geometria"]
        zona.save()
        if "geometria" in datos:
            _asignar_barrios(zona)
    return JsonResponse({"zona": _zona_json(zona)})


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------


def _ruta_json(ruta):
    return {
        "id": ruta.pk,
        "nombre": ruta.nombre,
        "descripcion": ruta.descripcion or "",
        "zona": ruta.zona_id,
        "perfil": ruta.perfil,
        "paradas": ruta.paradas,
        "geometria": ruta.geometria,
        "distancia_m": ruta.distancia_m,
        "duracion_s": ruta.duracion_s,
        "equipos": list(ruta.equipos.values_list("nombre", flat=True)),
    }


def _campana_de(usuario):
    """La campaña del usuario; si no tiene, la primera activa (o se crea una)."""
    if usuario.campana_id:
        return usuario.campana
    campana = Campana.objects.filter(activa=True).order_by("id_campana").first()
    return campana or Campana.objects.create(nombre="Campaña principal")


def _validar_paradas(paradas):
    if not isinstance(paradas, list) or len(paradas) < 2:
        return "Marcá al menos 2 puntos en el mapa."
    if len(paradas) > MAX_PARADAS:
        return f"Una ruta puede tener hasta {MAX_PARADAS} puntos."
    for p in paradas:
        if (
            not isinstance(p, list)
            or len(p) != 2
            or not all(isinstance(c, (int, float)) for c in p)
            or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90)
        ):
            return "Los puntos deben ser [longitud, latitud]."
    return None


def _guardar_ruta(ruta, datos):
    """Valida, calcula el recorrido con OpenRouteService y guarda."""
    nombre = (datos.get("nombre", ruta.nombre) or "").strip()
    if not nombre:
        return _error("Poné un nombre a la ruta.")
    repetida = Ruta.objects.filter(campana=ruta.campana, nombre__iexact=nombre)
    if ruta.pk:
        repetida = repetida.exclude(pk=ruta.pk)
    if repetida.exists():
        return _error("Ya existe una ruta con ese nombre.")

    perfil = datos.get("perfil", ruta.perfil)
    if perfil not in Ruta.Perfil.values:
        return _error("Elegí cómo se recorre: a pie, en auto o en bicicleta.")

    zona_id = datos.get("zona", ruta.zona_id)
    if zona_id and not Zona.objects.filter(pk=zona_id).exists():
        return _error("La zona elegida no existe.")

    paradas = datos.get("paradas", ruta.paradas)
    error = _validar_paradas(paradas)
    if error:
        return _error(error)

    if paradas != ruta.paradas or perfil != ruta.perfil or not ruta.geometria:
        try:
            ruta.geometria, ruta.distancia_m, ruta.duracion_s = calcular_ruta(paradas, perfil)
        except ErrorRuteo as e:
            return _error(str(e), 502)

    ruta.nombre = nombre
    ruta.descripcion = (datos.get("descripcion", ruta.descripcion) or "").strip() or None
    ruta.perfil = perfil
    ruta.paradas = paradas
    ruta.zona_id = zona_id or None
    ruta.save()
    return None


@require_http_methods(["GET", "POST"])
@requiere_sesion
def rutas(request):
    if request.method == "GET":
        lista = Ruta.objects.prefetch_related("equipos").order_by("nombre")
        return JsonResponse({"rutas": [_ruta_json(r) for r in lista]})

    datos = _leer_json(request)
    if datos is None:
        return _error("JSON inválido.")
    ruta = Ruta(campana=_campana_de(request.user), paradas=[])
    error = _guardar_ruta(ruta, datos)
    if error:
        return error
    return JsonResponse({"ruta": _ruta_json(ruta)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_sesion
def ruta_detalle(request, pk):
    ruta = get_object_or_404(Ruta, pk=pk)
    if request.method == "DELETE":
        ruta.delete()  # los equipos quedan sin ruta (SET_NULL)
        return JsonResponse({"ok": True})

    datos = _leer_json(request)
    if datos is None:
        return _error("JSON inválido.")
    error = _guardar_ruta(ruta, datos)
    if error:
        return error
    return JsonResponse({"ruta": _ruta_json(ruta)})
