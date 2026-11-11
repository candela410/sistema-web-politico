"""Pantalla Analítica: los gráficos del Módulo de Analítica (analitica/analitica.py)
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
    no, el de la campaña / los datos, igual que el script)."""
    desde, hasta = _fecha(request, "desde"), _fecha(request, "hasta")
    if desde and hasta and desde > hasta:
        raise FiltroInvalido("La fecha «desde» no puede ser posterior a «hasta».")
    c = request.campana
    campana = {"id_campana": c.pk, "nombre": c.nombre, "fecha_inicio": c.fecha_inicio, "fecha_fin": c.fecha_fin}
    todas = analitica.leer_encuestas(connection, campana)
    desde, hasta = analitica.rango_de_fechas(SimpleNamespace(desde=desde, hasta=hasta), campana, todas)
    return todas, desde, hasta


@require_GET
@requiere_permiso("core.view_encuesta")
def resumen(request):
    """Período que se va a mostrar y cuántas encuestas hay en él."""
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
    })


@require_GET
@requiere_permiso("core.view_encuesta")
def grafico(request, clave):
    """Imagen PNG de un gráfico (barras, donut, evolucion, heatmap o dashboard)."""
    if clave not in analitica.GRAFICOS:
        return error("Ese gráfico no existe.", 404)
    try:
        todas, desde, hasta = _datos(request)
        meta = request.GET.get("meta")
        meta = int(meta) if meta else None
        if meta is not None and meta <= 0:
            raise ValueError
    except FiltroInvalido as e:
        return error(str(e))
    except ValueError:
        return error("La meta tiene que ser un número mayor que 0.")
    fig = analitica.figura(clave, todas, desde, hasta, meta, request.campana.nombre) if desde else None
    if fig is None:
        return error("No hay encuestas en ese período.", 404)

    imagen = io.BytesIO()
    fig.savefig(imagen, format="png", dpi=110, bbox_inches="tight")
    analitica.plt.close(fig)
    respuesta = HttpResponse(imagen.getvalue(), content_type="image/png")
    respuesta["Cache-Control"] = "private, no-cache"
    return respuesta
