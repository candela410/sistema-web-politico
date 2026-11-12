"""API del mapa: barrios y calles (solo lectura), zonas y rutas (crear,
editar y borrar). Todo en GeoJSON. Barrios, calles y zonas son territorio
compartido por todas las campañas.

Las rutas no guardan campaña ni zona (como en el DER); se obtienen con
consultas: la campaña por rutas → equipos → usuarios, y la zona por
rutas → calles → barrios → zonas."""

import re

from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, requiere_permiso
from .api import error as _error
from .api import leer_json as _leer_json
from .bitacora import diferencias, registrar
from .geo import (
    ErrorRuteo,
    calcular_ruta,
    calles_del_recorrido,
    zona_de_poligono,
    es_poligono_valido,
    formato_distancia,
    formato_duracion,
    punto_en_poligono,
    se_pisan,
)
from .models import Barrio, Calle, Ruta, Zona
from .validaciones import nombre_cosa

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
        "aproximado": barrio.geometria_aproximada,
        "calles": getattr(barrio, "cantidad_calles", None),
    }


@require_http_methods(["GET"])
@requiere_permiso("core.view_barrio")
def barrios(request):
    lista = Barrio.objects.annotate(cantidad_calles=Count("calles")).order_by("nombre")
    return JsonResponse(
        _coleccion([_feature(b.geometria, _barrio_props(b)) for b in lista if b.geometria])
        | {"sin_geometria": sum(1 for b in lista if not b.geometria)}
    )


@require_http_methods(["GET"])
@requiere_permiso("core.view_calle")
def calles(request):
    consulta = Calle.objects.select_related("barrio")
    if request.GET.get("barrio"):
        consulta = consulta.filter(barrio_id=request.GET["barrio"])
    elif request.GET.get("zona"):
        consulta = consulta.filter(barrio__zona_id=request.GET["zona"])
    else:
        return _error("Indique ?barrio=ID o ?zona=ID.")
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


def _foto_zona(z):
    return {
        "Nombre": z.nombre,
        "Color": z.color,
        "Barrios": ", ".join(z.barrios.order_by("nombre").values_list("nombre", flat=True)),
    }


def reasignar_barrios():
    """Vuelve a calcular la zona de TODOS los barrios con las zonas actuales:
    cada barrio queda en la zona que contiene su centro o, si el centro no cae
    en ninguna, en la que cubre la mayor parte del barrio. Se llama cada vez
    que se crea, cambia o borra una zona, así ningún barrio queda desactualizado
    (antes solo se calculaba para la zona que se guardaba)."""
    zonas = list(Zona.objects.exclude(geometria=None).values_list("pk", "geometria"))
    nuevas = {}
    for id_barrio, geometria, actual in Barrio.objects.exclude(geometria=None).values_list("pk", "geometria", "zona_id"):
        zona = zona_de_poligono(geometria, zonas) if zonas else None
        if zona != actual:
            nuevas.setdefault(zona, []).append(id_barrio)
    for zona, ids in nuevas.items():
        Barrio.objects.filter(pk__in=ids).update(zona_id=zona)


def _validar_zona(datos, zona=None):
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return "Ingrese el nombre de la zona."
    if len(nombre) > 100:
        return "El nombre admite hasta 100 caracteres."
    mensaje = nombre_cosa(nombre)
    if mensaje:
        return mensaje
    repetida = Zona.objects.filter(nombre__iexact=nombre)
    if zona:
        repetida = repetida.exclude(pk=zona.pk)
    if repetida.exists():
        return "Ya existe una zona con ese nombre."
    if datos.get("color") and not COLOR_HEX.match(datos["color"]):
        return "El color debe tener el formato #RRGGBB."
    if "geometria" in datos:
        if not es_poligono_valido(datos["geometria"]):
            return "Dibuje la zona como un polígono en el mapa."
        # Las zonas no se pueden pisar: así cada ruta queda dentro de una sola
        otras = Zona.objects.exclude(geometria=None)
        if zona:
            otras = otras.exclude(pk=zona.pk)
        pisada = next((z for z in otras if se_pisan(datos["geometria"], z.geometria)), None)
        if pisada:
            return f"La zona se superpone con «{pisada.nombre}». Dibujala sin pisar otras zonas (pueden compartir el borde)."
    return None


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("zona"))
def zonas(request):
    if request.method == "GET":
        lista = Zona.objects.order_by("nombre")
        return JsonResponse({"zonas": [_zona_json(z) for z in lista]})

    datos = _leer_json(request)
    if datos is None:
        return _error("Los datos enviados no son válidos.")
    if "geometria" not in datos:
        return _error("Dibuje la zona como un polígono en el mapa.")
    error = _validar_zona(datos)
    if error:
        return _error(error)
    with transaction.atomic():
        zona = Zona.objects.create(
            nombre=datos["nombre"].strip(),
            color=datos.get("color") or "#51318f",
            geometria=datos["geometria"],
        )
        reasignar_barrios()
    registrar(request, zona, "crear", detalle=f"Creó la zona {zona.nombre} con {zona.barrios.count()} barrio(s)")
    return JsonResponse({"zona": _zona_json(zona)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("zona"))
def zona_detalle(request, pk):
    zona = get_object_or_404(Zona, pk=pk)
    if request.method == "DELETE":
        with transaction.atomic():
            zona.barrios.update(zona=None)
            zona.delete()
            reasignar_barrios()
        registrar(request, zona, "borrar", detalle=f"Borró la zona {zona.nombre}")
        return JsonResponse({"ok": True})

    datos = _leer_json(request)
    if datos is None:
        return _error("Los datos enviados no son válidos.")
    datos.setdefault("nombre", zona.nombre)
    error = _validar_zona(datos, zona)
    if error:
        return _error(error)
    antes = _foto_zona(zona)
    with transaction.atomic():
        zona.nombre = datos["nombre"].strip()
        zona.color = datos.get("color") or zona.color
        if "geometria" in datos:
            zona.geometria = datos["geometria"]
        zona.save()
        if "geometria" in datos:
            reasignar_barrios()
    cambios = diferencias(antes, _foto_zona(zona))
    if "geometria" in datos:
        cambios.append({"campo": "Contorno", "antes": "(contorno anterior)", "despues": "(contorno nuevo)"})
    if cambios:
        registrar(request, zona, "editar", cambios=cambios)
    return JsonResponse({"zona": _zona_json(zona)})


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------


def rutas_de_campana(campana):
    """Rutas que ve una campaña: las que tienen algún equipo con usuarios de
    esa campaña, más las que todavía no tienen gente asignada (sin equipo, o
    con equipos sin usuarios), que sirven para todas.

    SQL equivalente:
        SELECT DISTINCT r.* FROM rutas r
        LEFT JOIN equipos e ON e.id_ruta = r.id_ruta
        LEFT JOIN usuarios u ON u.id_equipo = e.id_equipo
        WHERE u.id_campana = %s
           OR r.id_ruta NOT IN (
               SELECT e2.id_ruta FROM equipos e2
               JOIN usuarios u2 ON u2.id_equipo = e2.id_equipo
           )
    """
    con_gente = Ruta.objects.filter(equipos__usuarios__isnull=False).values("pk")
    return Ruta.objects.filter(Q(equipos__usuarios__campana=campana) | ~Q(pk__in=con_gente)).distinct()


def zonas_de_ruta(ruta):
    """Zonas por las que pasa la ruta: las de sus calles (rutas → calles →
    barrios → zonas) y, además, la zona donde están sus puntos. Lo segundo
    cubre las rutas que comparten calles con otra ruta (una calle es de una
    sola ruta) o que pasan por calles sin barrio.

    SQL equivalente de la primera parte:
        SELECT DISTINCT z.* FROM zonas z
        JOIN barrios b ON b.id_zona = z.id_zona
        JOIN calles c ON c.id_barrio = b.id_barrio
        WHERE c.id_ruta = %s
    """
    por_calles = set(Zona.objects.filter(barrios__calles__ruta=ruta).values_list("pk", flat=True))
    por_puntos = {
        z.pk
        for z in Zona.objects.exclude(geometria=None)
        if any(punto_en_poligono(lng, lat, z.geometria) for lng, lat in (ruta.paradas or []))
    }
    return Zona.objects.filter(pk__in=por_calles | por_puntos).order_by("nombre")


def _asignar_calles(ruta):
    """Asigna a la ruta las calles por las que pasa su recorrido. Las calles
    que ya son de otra ruta no se tocan (una calle pertenece a una sola ruta)."""
    Calle.objects.filter(ruta=ruta).update(ruta=None)
    libres = Calle.objects.filter(ruta__isnull=True).exclude(geometria=None).values_list("pk", "geometria")
    ids = calles_del_recorrido(ruta.geometria, libres)
    Calle.objects.filter(pk__in=ids).update(ruta=ruta)


def _ruta_json(ruta):
    return {
        "id": ruta.pk,
        "nombre": ruta.nombre,
        "descripcion": ruta.descripcion or "",
        "zonas": list(zonas_de_ruta(ruta).values_list("nombre", flat=True)),
        "calles": ruta.calles.count(),
        "perfil": ruta.perfil,
        "paradas": ruta.paradas,
        "geometria": ruta.geometria,
        "distancia_m": ruta.distancia_m,
        "duracion_s": ruta.duracion_s,
        "equipos": list(ruta.equipos.values_list("nombre", flat=True)),
    }


def _validar_paradas(paradas):
    if not isinstance(paradas, list) or len(paradas) < 2:
        return "Marque al menos 2 puntos en el mapa."
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


def _validar_paradas_en_zona(paradas):
    """Todos los puntos de la ruta tienen que estar dentro de una misma zona.
    Devuelve el mensaje de error o None."""
    zonas = list(Zona.objects.exclude(geometria=None))
    if not zonas:
        return "Primero dibuje una zona: las rutas se crean dentro de una zona."
    candidatas = zonas
    for i, (lng, lat) in enumerate(paradas, start=1):
        contienen = [z for z in zonas if punto_en_poligono(lng, lat, z.geometria)]
        if not contienen:
            return f"El punto {i} queda fuera de todas las zonas. La ruta tiene que estar dentro de una zona."
        candidatas = [z for z in candidatas if z in contienen]
        if not candidatas:
            return f"El punto {i} está en otra zona. Todos los puntos de la ruta tienen que estar en la misma zona."
    return None


def _foto_ruta(r):
    return {
        "Nombre": r.nombre,
        "Notas": r.descripcion or "",
        "Calles": r.calles.count(),
        "Cómo se recorre": r.get_perfil_display(),
        "Puntos": len(r.paradas or []),
        "Distancia": formato_distancia(r.distancia_m),
        "Duración": formato_duracion(r.duracion_s),
    }


def _guardar_ruta(ruta, datos):
    """Valida, calcula el recorrido con OpenRouteService y guarda."""
    nombre = (datos.get("nombre", ruta.nombre) or "").strip()
    if not nombre:
        return _error("Ingrese el nombre de la ruta.")
    mensaje = nombre_cosa(nombre)
    if mensaje:
        return _error(mensaje)
    repetida = Ruta.objects.filter(nombre__iexact=nombre)
    if ruta.pk:
        repetida = repetida.exclude(pk=ruta.pk)
    if repetida.exists():
        return _error("Ya existe una ruta con ese nombre.")

    perfil = datos.get("perfil", ruta.perfil)
    if perfil not in Ruta.Perfil.values:
        return _error("Seleccione cómo se recorre: a pie, en auto o en bicicleta.")

    paradas = datos.get("paradas", ruta.paradas)
    error = _validar_paradas(paradas)
    if error:
        return _error(error)
    error = _validar_paradas_en_zona(paradas)
    if error:
        return _error(error)

    recalcular = paradas != ruta.paradas or perfil != ruta.perfil or not ruta.geometria
    if recalcular:
        try:
            ruta.geometria, ruta.distancia_m, ruta.duracion_s = calcular_ruta(paradas, perfil)
        except ErrorRuteo as e:
            return _error(str(e), 502)

    ruta.nombre = nombre
    ruta.descripcion = (datos.get("descripcion", ruta.descripcion) or "").strip() or None
    ruta.perfil = perfil
    ruta.paradas = paradas
    with transaction.atomic():
        ruta.save()
        if recalcular:
            _asignar_calles(ruta)
    return None


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("ruta"))
def rutas(request):
    if request.method == "GET":
        lista = rutas_de_campana(request.campana).prefetch_related("equipos").order_by("nombre")
        return JsonResponse({"rutas": [_ruta_json(r) for r in lista]})

    datos = _leer_json(request)
    if datos is None:
        return _error("Los datos enviados no son válidos.")
    ruta = Ruta(paradas=[])
    error = _guardar_ruta(ruta, datos)
    if error:
        return error
    registrar(request, ruta, "crear", detalle=f"Creó la ruta {ruta.nombre}")
    return JsonResponse({"ruta": _ruta_json(ruta)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("ruta"))
def ruta_detalle(request, pk):
    ruta = get_object_or_404(rutas_de_campana(request.campana), pk=pk)
    if request.method == "DELETE":
        if ruta.equipos.exists():
            return _error("No se puede eliminar la ruta porque tiene equipos asignados.", 409)
        with transaction.atomic():
            ruta.calles.update(ruta=None)
            ruta.delete()
        registrar(request, ruta, "borrar", detalle=f"Borró la ruta {ruta.nombre}")
        return JsonResponse({"ok": True})

    datos = _leer_json(request)
    if datos is None:
        return _error("Los datos enviados no son válidos.")
    antes = _foto_ruta(ruta)
    error = _guardar_ruta(ruta, datos)
    if error:
        return error
    ruta.refresh_from_db()
    cambios = diferencias(antes, _foto_ruta(ruta))
    if cambios:
        registrar(request, ruta, "editar", cambios=cambios)
    return JsonResponse({"ruta": _ruta_json(ruta)})
