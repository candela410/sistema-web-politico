"""Utilidades geográficas simples sobre GeoJSON (sin PostGIS).

Las coordenadas siguen el orden GeoJSON: [longitud, latitud].
"""

import json
import math
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


TOLERANCIA_BORDE_M = 5  # dos zonas que solo comparten el borde no se pisan


def _cruzan(a, b, c, d):
    """Los segmentos a-b y c-d se cruzan de verdad (no solo se tocan en una punta
    ni van uno encima del otro, como el borde que comparten dos zonas vecinas)."""

    def lado(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    eps = 1e-6
    d1, d2, d3, d4 = lado(c, d, a), lado(c, d, b), lado(a, b, c), lado(a, b, d)
    return ((d1 > eps and d2 < -eps) or (d1 < -eps and d2 > eps)) and (
        (d3 > eps and d4 < -eps) or (d3 < -eps and d4 > eps)
    )


def se_pisan(geometria_a, geometria_b, tolerancia_m=TOLERANCIA_BORDE_M):
    """True si dos polígonos (GeoJSON) se superponen. Compartir el borde no cuenta."""
    anillos_a = [p[0] for p in _anillos_exteriores(geometria_a) if p]
    anillos_b = [p[0] for p in _anillos_exteriores(geometria_b) if p]
    todos = [v for anillo in anillos_a + anillos_b for v in anillo]
    if not todos:
        return False
    # Se pasa a metros para comparar con la tolerancia
    lat0 = sum(v[1] for v in todos) / len(todos)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540

    def metros(anillos):
        return [[(v[0] * kx, v[1] * ky) for v in anillo] for anillo in anillos]

    a, b = metros(anillos_a), metros(anillos_b)
    tramos_a = [(r[i - 1], r[i]) for r in a for i in range(1, len(r))]
    tramos_b = [(r[i - 1], r[i]) for r in b for i in range(1, len(r))]

    if any(_cruzan(p, q, r, s) for p, q in tramos_a for r, s in tramos_b):
        return True

    def adentro(vertices, anillos, tramos):
        # Un vértice bien adentro del otro polígono (no sobre su borde)
        return any(
            any(_punto_en_anillo(v[0], v[1], anillo) for anillo in anillos)
            and min(_distancia_a_tramo(v, p, q) for p, q in tramos) > tolerancia_m
            for v in vertices
        )

    # Los centros cubren el caso de dos zonas iguales (todos los vértices sobre el borde)
    centros_a = [(c[0] * kx, c[1] * ky) for c in [centro(geometria_a)] if c]
    centros_b = [(c[0] * kx, c[1] * ky) for c in [centro(geometria_b)] if c]
    return adentro([v for r in a for v in r] + centros_a, b, tramos_b) or adentro(
        [v for r in b for v in r] + centros_b, a, tramos_a
    )


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
        if mensaje and "routable point" in mensaje:
            mensaje = "Uno de los puntos está lejos de una calle. Acercalo a una calle e intentá de nuevo."
        if error.code in (401, 403):
            mensaje = "La API key de OpenRouteService no es válida."
        raise ErrorRuteo(mensaje or "No se pudo calcular el recorrido. Intente nuevamente más tarde.") from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise ErrorRuteo("No se pudo calcular el recorrido. Intente nuevamente más tarde.") from error

    feature = datos["features"][0]
    resumen = feature["properties"].get("summary", {})
    return (
        feature["geometry"],
        round(resumen.get("distance", 0)),
        round(resumen.get("duration", 0)),
    )


def formato_distancia(metros):
    if metros is None:
        return "—"
    return f"{metros} m" if metros < 1000 else f"{metros / 1000:.1f} km".replace(".", ",")


def formato_duracion(segundos):
    if segundos is None:
        return "—"
    minutos = round(segundos / 60)
    return f"{minutos} min" if minutos < 60 else f"{minutos // 60} h {minutos % 60} min"


# ---------------------------------------------------------------------------
# Contorno aproximado de barrios que en OpenStreetMap son solo un punto
# ---------------------------------------------------------------------------

RADIO_BARRIO_M = 450
LADOS_CIRCULO = 24


def _recortar(poligono, a, b, c):
    """Sutherland–Hodgman: deja la parte del polígono donde a*x + b*y <= c."""
    resultado = []
    for i, actual in enumerate(poligono):
        previo = poligono[i - 1]
        dentro_actual = a * actual[0] + b * actual[1] <= c
        dentro_previo = a * previo[0] + b * previo[1] <= c
        if dentro_actual != dentro_previo:
            dx, dy = actual[0] - previo[0], actual[1] - previo[1]
            t = (c - a * previo[0] - b * previo[1]) / (a * dx + b * dy)
            resultado.append((previo[0] + t * dx, previo[1] + t * dy))
        if dentro_actual:
            resultado.append(actual)
    return resultado


def contornos_aproximados(puntos, vecinos, radio_m=RADIO_BARRIO_M):
    """Estima el contorno de cada barrio que solo tiene un punto.

    Cada barrio se queda con la zona que está más cerca de su punto que de
    cualquier otro barrio (celda de Voronoi), limitada a un círculo de
    radio_m metros. puntos: {id: (lng, lat)}; vecinos: centros de los demás
    barrios [(lng, lat), ...]. Devuelve {id: GeoJSON Polygon}.
    """
    if not puntos:
        return {}
    lat0 = sum(p[1] for p in puntos.values()) / len(puntos)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540  # metros por grado

    def a_metros(p):
        return (p[0] * kx, p[1] * ky)

    semillas = [a_metros(p) for p in list(puntos.values()) + list(vecinos)]
    contornos = {}
    for id_barrio, punto in puntos.items():
        px, py = a_metros(punto)
        poligono = [
            (px + radio_m * math.cos(2 * math.pi * i / LADOS_CIRCULO), py + radio_m * math.sin(2 * math.pi * i / LADOS_CIRCULO))
            for i in range(LADOS_CIRCULO)
        ]
        for qx, qy in semillas:
            dx, dy = qx - px, qy - py
            if (dx == 0 and dy == 0) or dx * dx + dy * dy > (2 * radio_m) ** 2:
                continue
            # Mitad del plano más cerca de este barrio que del vecino
            poligono = _recortar(poligono, dx, dy, dx * (px + qx) / 2 + dy * (py + qy) / 2)
            if len(poligono) < 3:
                break
        if len(poligono) >= 3:
            anillo = [[round(x / kx, 6), round(y / ky, 6)] for x, y in poligono]
            anillo.append(anillo[0])
            contornos[id_barrio] = {"type": "Polygon", "coordinates": [anillo]}
    return contornos


# ---------------------------------------------------------------------------
# Calles por las que pasa una ruta
# ---------------------------------------------------------------------------

DISTANCIA_CALLE_M = 15  # tolerancia entre el recorrido y el trazado de la calle


def _distancia_a_tramo(p, a, b):
    """Distancia (en las mismas unidades) del punto p al segmento a-b."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    largo2 = dx * dx + dy * dy
    t = 0 if largo2 == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo2))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def calles_del_recorrido(recorrido, calles, tolerancia_m=DISTANCIA_CALLE_M):
    """Ids de las calles por las que pasa el recorrido (GeoJSON LineString).

    calles: [(id, GeoJSON MultiLineString), ...]. Una calle cuenta si al menos
    2 de sus puntos quedan a menos de tolerancia_m del recorrido; así no se
    cuentan las calles que solo lo cruzan (tocan el recorrido en 1 punto).
    """
    linea = (recorrido or {}).get("coordinates") or []
    if len(linea) < 2:
        return []
    lat0 = sum(p[1] for p in linea) / len(linea)
    kx, ky = 111320 * math.cos(math.radians(lat0)), 110540
    tramos = [((a[0] * kx, a[1] * ky), (b[0] * kx, b[1] * ky)) for a, b in zip(linea, linea[1:])]
    xs = [p[0] * kx for p in linea]
    ys = [p[1] * ky for p in linea]
    minx, maxx = min(xs) - tolerancia_m, max(xs) + tolerancia_m
    miny, maxy = min(ys) - tolerancia_m, max(ys) + tolerancia_m

    ids = []
    for id_calle, geometria in calles:
        cerca = 0
        for parte in (geometria or {}).get("coordinates") or []:
            for lng, lat in parte:
                p = (lng * kx, lat * ky)
                if not (minx <= p[0] <= maxx and miny <= p[1] <= maxy):
                    continue
                if any(_distancia_a_tramo(p, a, b) <= tolerancia_m for a, b in tramos):
                    cerca += 1
                    if cerca >= 2:
                        break
            if cerca >= 2:
                break
        if cerca >= 2:
            ids.append(id_calle)
    return ids
