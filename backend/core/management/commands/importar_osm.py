"""Carga barrios y calles de una ciudad desde OpenStreetMap.

    python manage.py importar_osm "Córdoba, Córdoba, Argentina"
    python manage.py importar_osm "Córdoba, Córdoba, Argentina" --simular

Se puede correr varias veces: actualiza lo que ya existe y no borra nada.
"""

import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.geo import caja, centro, punto_en_poligono
from core.models import Barrio, Calle

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Servidor principal y espejo: Overpass suele responder 429/502/504 cuando está cargado
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
AGENTE = "sistema-web-politico/1.0 (importador de barrios)"

TIPOS_DE_CALLE = (
    "trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian"
)


def _pedir_json(url, datos=None):
    pedido = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(datos).encode() if datos else None,
        headers={"User-Agent": AGENTE},
    )
    with urllib.request.urlopen(pedido, timeout=300) as respuesta:
        return json.load(respuesta)


def _overpass(consulta):
    ultimo_error = None
    for intento in range(3):
        for url in OVERPASS_URLS:
            try:
                return _pedir_json(url, {"data": consulta})["elements"]
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as error:
                ultimo_error = error
        time.sleep(15 * (intento + 1))
    raise CommandError(f"OpenStreetMap (Overpass) no respondió: {ultimo_error}")


def _unir_tramos(tramos):
    """Une los tramos (listas de [lng, lat]) de una relación en anillos cerrados."""
    pendientes = [list(t) for t in tramos if len(t) >= 2]
    anillos = []
    while pendientes:
        anillo = pendientes.pop(0)
        cambio = True
        while anillo[0] != anillo[-1] and cambio:
            cambio = False
            for i, tramo in enumerate(pendientes):
                if tramo[0] == anillo[-1]:
                    anillo += tramo[1:]
                elif tramo[-1] == anillo[-1]:
                    anillo += tramo[-2::-1]
                elif tramo[-1] == anillo[0]:
                    anillo = tramo[:-1] + anillo
                elif tramo[0] == anillo[0]:
                    anillo = tramo[:0:-1] + anillo
                else:
                    continue
                pendientes.pop(i)
                cambio = True
                break
        if len(anillo) >= 4 and anillo[0] == anillo[-1]:
            anillos.append(anillo)
    return anillos


def _geometria_de(elemento):
    if elemento["type"] == "node":
        return {"type": "Point", "coordinates": [elemento["lon"], elemento["lat"]]}

    if elemento["type"] == "way":
        anillo = [[p["lon"], p["lat"]] for p in elemento.get("geometry", [])]
        if len(anillo) >= 4 and anillo[0] == anillo[-1]:
            return {"type": "Polygon", "coordinates": [anillo]}
        return None

    exteriores, interiores = [], []
    for miembro in elemento.get("members", []):
        if miembro["type"] != "way" or "geometry" not in miembro:
            continue
        tramo = [[p["lon"], p["lat"]] for p in miembro["geometry"]]
        (interiores if miembro.get("role") == "inner" else exteriores).append(tramo)
    poligonos = [[a] for a in _unir_tramos(exteriores)]
    if not poligonos:
        return None
    for agujero in _unir_tramos(interiores):
        for poligono in poligonos:
            if punto_en_poligono(*agujero[0], {"type": "Polygon", "coordinates": [poligono[0]]}):
                poligono.append(agujero)
                break
    if len(poligonos) == 1:
        return {"type": "Polygon", "coordinates": poligonos[0]}
    return {"type": "MultiPolygon", "coordinates": poligonos}


class Command(BaseCommand):
    help = "Carga barrios y calles de una ciudad desde OpenStreetMap."

    def add_arguments(self, parser):
        parser.add_argument("ciudad", help='Por ejemplo: "Córdoba, Córdoba, Argentina"')
        parser.add_argument(
            "--simular", action="store_true", help="Muestra qué cargaría sin guardar nada."
        )

    def handle(self, ciudad, simular, **opciones):
        area_id, nombre = self._buscar_ciudad(ciudad)
        self.stdout.write(f"Ciudad: {nombre}")

        barrios = self._descargar_barrios(area_id)
        if not barrios:
            raise CommandError(
                "OpenStreetMap no tiene barrios cargados para esta ciudad. "
                "Probá con otro nombre o cargalos a mano."
            )
        self.stdout.write(f"Barrios encontrados: {len(barrios)}")

        calles = self._descargar_calles(area_id)
        asignadas = self._asignar_calles(barrios, calles)
        self.stdout.write(f"Calles encontradas: {len(asignadas)} (calle + barrio)")

        if simular:
            for b in barrios[:15]:
                self.stdout.write(f"  - {b['nombre']} ({b['geometria']['type']})")
            self.stdout.write(self.style.WARNING("Simulación: no se guardó nada."))
            return

        # Inserciones en bloque: con una base remota (Neon) cada consulta suma
        # latencia, así que se evita guardar fila por fila.
        with transaction.atomic():
            # Un barrio existente se reconoce por su osm_id o, si OpenStreetMap
            # cambió el elemento, por su nombre (que es único).
            existentes = list(Barrio.objects.all())
            por_id_osm = {b.osm_id: b for b in existentes if b.osm_id is not None}
            por_nombre = {b.nombre.lower(): b for b in existentes}
            nuevos, actualizados = [], []
            for b in barrios:
                barrio = por_id_osm.get(b["osm_id"]) or por_nombre.get(b["nombre"].lower())
                if barrio is None:
                    nuevos.append(Barrio(osm_id=b["osm_id"], nombre=b["nombre"], geometria=b["geometria"]))
                    continue
                if barrio.osm_id != b["osm_id"]:
                    # Libera el osm_id si lo tenía otro barrio
                    otro = por_id_osm.get(b["osm_id"])
                    if otro and otro is not barrio:
                        otro.osm_id = None
                        actualizados.append(otro)
                barrio.osm_id, barrio.nombre, barrio.geometria = b["osm_id"], b["nombre"], b["geometria"]
                actualizados.append(barrio)
            Barrio.objects.bulk_update(actualizados, ["osm_id", "nombre", "geometria"], batch_size=200)
            Barrio.objects.bulk_create(nuevos, batch_size=200)
            por_osm = dict(
                Barrio.objects.filter(osm_id__in=[b["osm_id"] for b in barrios]).values_list("osm_id", "pk")
            )
            Calle.objects.bulk_create(
                [
                    Calle(
                        barrio_id=por_osm[osm_id],
                        nombre=nombre_calle,
                        geometria={"type": "MultiLineString", "coordinates": tramos},
                    )
                    for (osm_id, nombre_calle), tramos in asignadas.items()
                ],
                update_conflicts=True,
                unique_fields=["barrio", "nombre"],
                update_fields=["geometria"],
                batch_size=500,
            )
        self.stdout.write(self.style.SUCCESS("Barrios y calles guardados."))

    def _buscar_ciudad(self, ciudad):
        resultados = _pedir_json(
            NOMINATIM_URL
            + "?"
            + urllib.parse.urlencode({"q": ciudad, "format": "json", "limit": 5})
        )
        for r in resultados:
            if r.get("osm_type") == "relation":
                return 3600000000 + int(r["osm_id"]), r["display_name"]
        raise CommandError(f'No encontré "{ciudad}" como ciudad en OpenStreetMap.')

    def _descargar_barrios(self, area_id):
        elementos = _overpass(f"""
            [out:json][timeout:240];
            area(id:{area_id})->.a;
            (
              relation(area.a)["boundary"="administrative"]["admin_level"~"^(9|10)$"]["name"];
              relation(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];
              way(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];
              node(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];
            );
            out geom;
        """)
        barrios, vistos = [], set()
        # Primero los que tienen contorno, después los que son solo un punto
        elementos.sort(key=lambda e: e["type"] == "node")
        for e in elementos:
            nombre = e.get("tags", {}).get("name", "").strip()[:120]
            geometria = _geometria_de(e)
            if not nombre or not geometria or nombre.lower() in vistos:
                continue
            vistos.add(nombre.lower())
            # osm_id único entre tipos: nodos negativos, vías pares, relaciones impares
            osm_id = {
                "node": -e["id"],
                "way": e["id"] * 2,
                "relation": e["id"] * 2 + 1,
            }[e["type"]]
            barrios.append({
                "osm_id": osm_id,
                "nombre": nombre,
                "geometria": geometria,
                "caja": caja(geometria),
                "centro": centro(geometria),
            })
        return barrios

    def _descargar_calles(self, area_id):
        return _overpass(f"""
            [out:json][timeout:240];
            area(id:{area_id})->.a;
            way(area.a)["highway"~"^({TIPOS_DE_CALLE})$"]["name"];
            out geom;
        """)

    def _asignar_calles(self, barrios, calles):
        """Asigna cada tramo de calle al barrio que contiene su punto medio
        (o al barrio más cercano si ninguno lo contiene)."""
        asignadas = defaultdict(list)
        for via in calles:
            tramo = [[p["lon"], p["lat"]] for p in via.get("geometry", [])]
            if len(tramo) < 2:
                continue
            lng, lat = tramo[len(tramo) // 2]
            elegido = None
            for b in barrios:
                c = b["caja"]
                if c and c[0] <= lng <= c[2] and c[1] <= lat <= c[3]:
                    if punto_en_poligono(lng, lat, b["geometria"]):
                        elegido = b
                        break
            if elegido is None:
                elegido = min(
                    barrios,
                    key=lambda b: math.hypot(b["centro"][0] - lng, b["centro"][1] - lat),
                )
            nombre = via["tags"]["name"].strip()[:150]
            asignadas[(elegido["osm_id"], nombre)].append(tramo)
        return asignadas
