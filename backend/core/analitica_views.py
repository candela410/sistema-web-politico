"""Pantalla Dashboard: los gráficos del Módulo de Analítica (analitica/analitica.py)
generados al momento para la campaña activa, con los filtros de la pantalla.

El script y esta pantalla usan las mismas funciones, así que los gráficos son
iguales; acá los datos se leen con la conexión de Django en vez de psycopg.
"""

import io
import sys
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from django.conf import settings
from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from .api import error, requiere_permiso
from .cuestionarios_views import cuestionarios_de_campana
from .models import Zona

sys.path.insert(0, str(Path(settings.BASE_DIR).parent / "analitica"))
import analitica  # noqa: E402


class FiltroInvalido(Exception):
    pass


def _fecha(request, nombre):
    valor = request.GET.get(nombre)
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise FiltroInvalido(f"La fecha «{valor}» no es válida.") from None


def _datos(request):
    """Encuestas de la campaña activa y el período a mostrar (el pedido o, si
    no, de la primera a la última encuesta, igual que el script)."""
    desde, hasta = _fecha(request, "desde"), _fecha(request, "hasta")
    if desde and hasta and desde > hasta:
        raise FiltroInvalido("La fecha «desde» no puede ser posterior a la fecha «hasta».")
    c = request.campana
    todas = analitica.leer_encuestas(connection, {"id_campana": c.pk, "nombre": c.nombre})
    desde, hasta = analitica.rango_de_fechas(SimpleNamespace(desde=desde, hasta=hasta), todas)
    return todas, desde, hasta


def _imagen(fig):
    imagen = io.BytesIO()
    fig.savefig(imagen, format="png", dpi=110, bbox_inches="tight")
    analitica.plt.close(fig)
    respuesta = HttpResponse(imagen.getvalue(), content_type="image/png")
    respuesta["Cache-Control"] = "private, no-cache"
    return respuesta


@require_GET
@requiere_permiso("core.view_encuesta")
def resumen(request):
    """Período que se va a mostrar, cuántas encuestas hay en él y las opciones
    para el gráfico de respuestas (cuestionarios de la campaña y zonas)."""
    try:
        todas, desde, hasta = _datos(request)
    except FiltroInvalido as e:
        return error(str(e))
    encuestas = len(analitica.filtrar(todas, desde, hasta)) if desde else 0
    return JsonResponse({
        "desde": desde.isoformat() if desde else None,
        "hasta": hasta.isoformat() if hasta else None,
        "encuestas": encuestas,
        "graficos": list(analitica.GRAFICOS),
        "cuestionarios": [
            {"id": c.pk, "titulo": c.titulo}
            for c in cuestionarios_de_campana(request.campana).order_by("titulo")
        ],
        "zonas": [{"id": z.pk, "nombre": z.nombre} for z in Zona.objects.order_by("nombre")],
    })


def _respuestas(request):
    """Gráfico 6: respuestas de un cuestionario de la campaña en una zona."""
    try:
        id_cuestionario = int(request.GET.get("cuestionario", ""))
    except ValueError:
        return error("Seleccione un cuestionario.")
    cuestionario = cuestionarios_de_campana(request.campana).filter(pk=id_cuestionario).first()
    if cuestionario is None:
        return error("El cuestionario no existe en esta campaña.", 404)
    zona = None
    if request.GET.get("zona"):
        zona = Zona.objects.filter(pk=request.GET["zona"]).first() if request.GET["zona"].isdigit() else None
        if zona is None:
            return error("La zona no existe.", 404)
        zona = {"nombre": zona.nombre, "geometria": zona.geometria}
    respuestas = analitica.leer_respuestas(connection, cuestionario.pk)
    fig = analitica.figura_respuestas(respuestas, cuestionario.titulo, zona, request.campana.nombre)
    if fig is None:
        cargadas = respuestas[respuestas["id_respuesta"].notna()]
        sin_ubicacion = int(cargadas["latitud"].isna().sum())
        lugar = f"en {zona['nombre']}" if zona else "en ninguna zona"
        mensaje = f"Todavía no hay respuestas de «{cuestionario.titulo}» con ubicación {lugar}."
        if sin_ubicacion:
            mensaje += (
                f" Las {sin_ubicacion} respuestas cargadas antes de que se guardara la ubicación"
                " no se pueden ubicar en una zona."
            )
        return error(mensaje, 404)
    return _imagen(fig)


@require_GET
@requiere_permiso("core.view_encuesta")
def grafico(request, clave):
    """Imagen PNG de un gráfico (periodo, donut, evolucion, heatmap, dashboard
    o respuestas)."""
    if clave == "respuestas":
        return _respuestas(request)
    if clave not in analitica.GRAFICOS:
        return error("El gráfico no existe.", 404)
    try:
        todas, desde, hasta = _datos(request)
    except FiltroInvalido as e:
        return error(str(e))
    fig = analitica.figura(clave, todas, desde, hasta, request.campana.nombre) if desde else None
    if fig is None:
        return error("No hay encuestas en ese período.", 404)
    return _imagen(fig)
