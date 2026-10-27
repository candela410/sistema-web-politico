"""Estima el contorno de los barrios que en OpenStreetMap son solo un punto.

    python manage.py aproximar_barrios

Se corre solo al final de importar_osm; este comando sirve para datos ya cargados.
"""

from django.core.management.base import BaseCommand

from core.geo import centro, contornos_aproximados
from core.models import Barrio


def aproximar_puntos():
    """Reemplaza el punto de cada barrio sin contorno por un polígono estimado
    y lo marca como aproximado. Devuelve cuántos barrios cambió."""
    puntos, vecinos = {}, []
    for barrio in Barrio.objects.exclude(geometria=None):
        if barrio.geometria.get("type") == "Point":
            puntos[barrio.pk] = tuple(barrio.geometria["coordinates"][:2])
        else:
            c = centro(barrio.geometria)
            if c:
                vecinos.append(c)
    contornos = contornos_aproximados(puntos, vecinos)
    cambiados = Barrio.objects.filter(pk__in=contornos)
    for barrio in cambiados:
        barrio.geometria = contornos[barrio.pk]
        barrio.geometria_aproximada = True
    Barrio.objects.bulk_update(cambiados, ["geometria", "geometria_aproximada"], batch_size=200)
    return len(contornos)


class Command(BaseCommand):
    help = "Estima el contorno de los barrios que solo tienen un punto."

    def handle(self, **opciones):
        n = aproximar_puntos()
        self.stdout.write(self.style.SUCCESS(f"Contorno aproximado para {n} barrio(s)."))
