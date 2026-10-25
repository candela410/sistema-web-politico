"""Utilidades geográficas simples sobre GeoJSON (sin PostGIS).

Las coordenadas siguen el orden GeoJSON: [longitud, latitud].
"""

import json
import os
import urllib.error
import urllib.request


def _anillos_exteriores(geometria):
    """Devuelve una lista de polígonos; cada polígono es [exterior, *agujeros]."""
    if not geometria:
        return []
    tipo = geometria.get("type")
    if tipo == "Polygon":
        return [geometria["coordinates"]]
    if tipo == "MultiPolygon":
        return geometria["coordinates"]
    if tipo == "Feature":
        return _anillos_exteriores(geometria.get("geometry"))
    return []


def _punto_en_anillo(lng, lat, anillo):
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i][0], anillo[i][1]
        xj, yj = anillo[j][0], anillo[j][1]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def punto_en_poligono(lng, lat, geometria):
    for poligono in _anillos_exteriores(geometria):
        if not poligono:
            continue
        exterior, *agujeros = poligono
        if _punto_en_anillo(lng, lat, exterior) and not any(
            _punto_en_anillo(lng, lat, a) for a in agujeros
        ):
            return True
    return False


def centro(geometria):
    """Centro aproximado. Un Point devuelve sus coordenadas; un polígono, el
    promedio de los vértices de su anillo exterior más grande.

    Si ese promedio cae fuera (barrios con forma de L), busca un punto
    intermedio que sí quede dentro.
    """
    if geometria and geometria.get("type") == "Point":
        return tuple(geometria["coordinates"][:2])
    poligonos = _anillos_exteriores(geometria)
    if not poligonos:
        return None
    exterior = max((p[0] for p in poligonos if p), key=len)
    puntos = exterior[:-1] if exterior[0] == exterior[-1] else exterior
    lng = sum(p[0] for p in puntos) / len(puntos)
    lat = sum(p[1] for p in puntos) / len(puntos)
    if punto_en_poligono(lng, lat, geometria):
        return lng, lat
    # Promedio entre cada vértice y el centro: casi siempre queda dentro
    for p in sorted(puntos, key=lambda p: (p[0] - lng) ** 2 + (p[1] - lat) ** 2):
        mx, my = (p[0] + lng) / 2, (p[1] + lat) / 2
        if punto_en_poligono(mx, my, geometria):
            return mx, my
    return lng, lat


def caja(geometria):
    """(min_lng, min_lat, max_lng, max_lat) de un polígono, o None."""
    puntos = [c for p in _anillos_exteriores(geometria) for c in (p[0] if p else [])]
    if not puntos:
        return None
    return (
        min(c[0] for c in puntos),
        min(c[1] for c in puntos),
        max(c[0] for c in puntos),
        max(c[1] for c in puntos),
    )


def es_poligono_valido(geometria):
    if not isinstance(geometria, dict) or geometria.get("type") not in ("Polygon", "MultiPolygon"):
        return False
    try:
        poligonos = _anillos_exteriores(geometria)
        return bool(poligonos) and all(
            len(p[0]) >= 4 and all(-180 <= c[0] <= 180 and -90 <= c[1] <= 90 for c in p[0])
            for p in poligonos
        )
    except (TypeError, IndexError, KeyError):
        return False


# ---------------------------------------------------------------------------
# OpenRouteService
# ---------------------------------------------------------------------------

ORS_URL = "https://api.openrouteservice.org/v2/directions/{perfil}/geojson"


class ErrorRuteo(Exception):
    pass


def calcular_ruta(paradas, perfil):
    """Pide a OpenRouteService el recorrido que pasa por las paradas en orden.

    Devuelve (geometria LineString, distancia en metros, duración en segundos).
    """
    clave = os.environ.get("ORS_API_KEY")
    if not clave:
        raise ErrorRuteo(
            "Falta configurar ORS_API_KEY en backend/.env para calcular rutas."
        )

    cuerpo = json.dumps({"coordinates": paradas, "instructions": False}).encode()
    pedido = urllib.request.Request(
        ORS_URL.format(perfil=perfil),
        data=cuerpo,
        headers={
            "Authorization": clave,
            "Content-Type": "application/json",
            "Accept": "application/geo+json",
        },
    )
    try:
        with urllib.request.urlopen(pedido, timeout=30) as respuesta:
            datos = json.load(respuesta)
    except urllib.error.HTTPError as error:
        try:
            detalle = json.load(error).get("error", {})
            mensaje = detalle.get("message") if isinstance(detalle, dict) else str(detalle)
        except ValueError:
            mensaje = None
        if error.code in (401, 403):
            mensaje = "La API key de OpenRouteService no es válida."
        raise ErrorRuteo(mensaje or f"OpenRouteService respondió {error.code}.") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise ErrorRuteo("No se pudo conectar con OpenRouteService.") from error

    feature = datos["features"][0]
    resumen = feature["properties"].get("summary", {})
    return (
        feature["geometry"],
        round(resumen.get("distance", 0)),
        round(resumen.get("duration", 0)),
    )
