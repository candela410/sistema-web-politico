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


# ---------------------------------------------------------------------------
# Explicación de cada gráfico
# ---------------------------------------------------------------------------

DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _n(valor, decimales=1):
    """Número como se escribe en Argentina: 1.234,5 (sin decimales si es entero)."""
    texto = f"{valor:,.{decimales}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return texto.rstrip("0").rstrip(",") if "," in texto else texto


def _cuantas(n, uno="encuesta", varios="encuestas"):
    return f"{_n(n, 0)} {uno if n == 1 else varios}"


def explicaciones(todas, desde, hasta):
    """{clave del gráfico: [párrafos]}: cómo se lee cada gráfico del Dashboard
    y qué muestran los datos del período. Usa los mismos cálculos que los
    gráficos (analitica.py), así el texto coincide con la imagen."""
    df = analitica.filtrar(todas, desde, hasta)
    if df.empty:
        return {}
    pd, np = analitica.pd, analitica.np
    total = len(df)
    hoy = pd.Timestamp(min(analitica.datetime.now(analitica.ZONA).date(), hasta))
    por_dia, acumulado = analitica.serie_diaria(df, desde, hasta)
    tendencia = analitica.proyeccion(por_dia, acumulado, hoy)
    por_militante, medidas = analitica.medidas_por_militante(df)
    por_equipo = df["equipo"].value_counts()

    # 1. Encuestas por período
    frecuencia, nombre = analitica.periodicidad(desde, hasta)
    periodos = pd.period_range(desde, hasta, freq=frecuencia)
    por_periodo = (
        df["momento"].dt.tz_localize(None).dt.to_period(frecuencia).value_counts().reindex(periodos, fill_value=0)
    )
    mayor = por_periodo.idxmax()
    vacios = int((por_periodo == 0).sum())
    articulo = "el" if nombre != "semana" else "la"
    conector = {"día": "", "semana": "del ", "mes": "de "}[nombre]
    etiqueta = analitica.etiqueta_periodo(mayor.start_time, frecuencia)
    periodo = [
        f"Cada barra muestra cuántas encuestas se cargaron en cada {nombre} del período; la línea punteada marca el "
        f"promedio. Las barras que superan esa línea son los momentos de mayor trabajo en territorio.",
        f"En el período se cargaron {_cuantas(total)}, con un promedio de {_n(float(np.mean(por_periodo.to_numpy())))} "
        f"por {nombre}. El punto más alto fue {articulo} {nombre} {conector}{etiqueta}, "
        f"con {_cuantas(int(por_periodo.max()))}."
        + (f" Hubo {_n(vacios, 0)} {nombre}{'es' if nombre == 'mes' else 's'} sin encuestas cargadas."
           if vacios > 1 else (f" Hubo 1 {nombre} sin encuestas cargadas." if vacios else "")),
    ]

    # 2. Participación por equipo
    primero = por_equipo.index[0]
    donut = [
        "El anillo representa el total de encuestas del período y cada porción es la parte que aportó un equipo: "
        "cuanto más grande la porción, mayor fue su aporte. El número del centro es el total.",
        f"Cargaron encuestas {_cuantas(len(por_equipo), 'equipo', 'equipos')}. El que más aportó fue {primero}, con "
        f"{_cuantas(int(por_equipo.iloc[0]))} ({_n(100 * por_equipo.iloc[0] / total)} % del total)."
        + (f" El de menor aporte fue {por_equipo.index[-1]}, con {_cuantas(int(por_equipo.iloc[-1]))} "
           f"({_n(100 * por_equipo.iloc[-1] / total)} %)." if len(por_equipo) > 1 else ""),
    ]
    if "Sin equipo" in por_equipo.index:
        donut.append("«Sin equipo» agrupa las encuestas cargadas por usuarios que no tienen un equipo asignado.")

    # 3. Evolución
    reales = acumulado[acumulado.index <= hoy]
    ritmo = float(np.mean(por_dia[por_dia.index <= hoy].tail(14).to_numpy()))
    evolucion = [
        "La línea muestra las encuestas acumuladas día a día: nunca baja, y cuanto más empinada es, más rápido se "
        "cargaron encuestas. Los tramos planos son días sin carga.",
        f"Hasta el {hoy:%d/%m/%Y} se acumularon {_cuantas(int(reales.iloc[-1]))}. En los últimos 14 días el ritmo fue "
        f"de {_n(ritmo)} encuestas por día."
        + (f" La línea de puntos proyecta ese ritmo hasta el final del período ({hasta:%d/%m/%Y}): se llegaría a "
           f"unas {_n(float(tendencia.iloc[-1]), 0)} encuestas." if tendencia is not None else
           " El período ya terminó, por eso no se dibuja una proyección."),
    ]

    # 4. Días y horarios
    tabla = (
        df.assign(dia=df["momento"].dt.day_of_week, hora=df["momento"].dt.hour)
        .groupby(["dia", "hora"]).size()
    )
    dia_tope, hora_tope = tabla.idxmax()
    por_dia_semana = df["momento"].dt.day_of_week.value_counts()
    por_hora = df["momento"].dt.hour.value_counts()
    heatmap = [
        "Cada casillero cruza un día de la semana (filas) con una hora (columnas). Cuanto más oscuro el color, más "
        "encuestas se cargaron en ese momento; el número dentro del casillero es la cantidad.",
        f"El momento de mayor carga fue el {DIAS_LARGOS[int(dia_tope)]} a las {int(hora_tope):02d} h, con "
        f"{_cuantas(int(tabla.max()))}. El día de la semana con más encuestas es el "
        f"{DIAS_LARGOS[int(por_dia_semana.idxmax())]} ({_cuantas(int(por_dia_semana.max()))}) y la hora más activa, "
        f"las {int(por_hora.idxmax()):02d} h ({_cuantas(int(por_hora.max()))}).",
    ]

    # 5. Tablero
    activos = por_dia[por_dia.index <= hoy]
    (mejor, equipo_mejor) = por_militante.index[0]
    tablero = [
        "El tablero resume la campaña en una sola imagen: arriba los números clave y debajo las encuestas "
        "acumuladas, el aporte de cada equipo, los cinco usuarios que más cargaron (la línea punteada es la media "
        "por usuario) y la cantidad de encuestas por día de la semana.",
        f"En el período se cargaron {_cuantas(total)} entre {_cuantas(medidas['militantes'], 'usuario', 'usuarios')}: "
        f"una media de {_n(medidas['media'])} por usuario (mediana {_n(medidas['mediana'])}) y de "
        f"{_n(float(activos.mean()))} por día. Quien más cargó fue {mejor} ({equipo_mejor}), con "
        f"{_cuantas(int(por_militante.iloc[0]))}.",
    ]
    inusuales = medidas["inusuales"]
    if len(inusuales):
        nombres = ", ".join(f"{m} ({_n(int(c), 0)})" for (m, _), c in inusuales.items())
        tablero.append(
            f"Carga inusualmente alta (más de 2 desvíos estándar sobre la media), conviene revisarla: {nombres}."
        )

    return {"periodo": periodo, "donut": donut, "evolucion": evolucion, "heatmap": heatmap, "dashboard": tablero}


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
        # Texto que explica cada gráfico con los datos del período (para el PDF)
        "explicaciones": explicaciones(todas, desde, hasta) if encuestas else {},
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
        return error("No hay respuestas con ubicación para ese cuestionario en esa zona.", 404)
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
