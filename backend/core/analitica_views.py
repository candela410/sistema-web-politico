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
from .tema_graficos import oscurecer, pide_oscuro

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


def _imagen(fig, request):
    # ?tema=oscuro: la pantalla está en modo oscuro (ver tema_graficos.py)
    if pide_oscuro(request):
        oscurecer(fig)
    imagen = io.BytesIO()
    fig.savefig(imagen, format="png", dpi=110, bbox_inches="tight", facecolor=fig.get_facecolor())
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
    return _imagen(fig, request)


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
    return _imagen(fig, request)


# ---------------------------------------------------------------------------
# Respuestas por zona y cuestionario (filtros del Dashboard)
# ---------------------------------------------------------------------------
#
# La zona de cada encuesta es la del LUGAR DONDE SE CARGÓ: el punto GPS del
# celular (encuestas.latitud/longitud) cae dentro del polígono de la zona.
# Cada respuesta guarda el mismo punto (respuesta_cargada.latitud/longitud),
# así que las respuestas de cada zona se cuentan con ese punto, sin mezclar
# zonas. Lo que se cargó sin GPS (por ejemplo, desde la web) no tiene zona.
#   respuesta_cargada → opciones → preguntas → cuestionarios
#
# Se pueden elegir varias zonas (?zona=1,2,3) para compararlas: cada gráfico
# muestra, por opción, el porcentaje de las encuestas de cada zona que la eligió.

MAXIMO_ZONAS = 6
# Colores de las zonas en los gráficos de comparación (si la zona no tiene color propio)
COLORES_ZONAS = ["#51318f", "#2fb4e9", "#c3268c", "#f7a832", "#1f8a5b", "#eb6834"]


def _filas(sql, parametros):
    with connection.cursor() as cur:
        cur.execute(sql, parametros)
        return cur.fetchall()


def _adentro(geometria, puntos):
    """Máscara de los puntos [(lat, lng), ...] que caen dentro de la zona."""
    if not puntos:
        return []
    lat = [float(p[0]) for p in puntos]
    lng = [float(p[1]) for p in puntos]
    return [bool(x) for x in analitica.dentro_de(geometria, lat, lng)]


def _zona_de(puntos, zonas):
    """Nombre de la zona de cada punto (la primera por nombre si se superponen),
    "Fuera de las zonas" si no cae en ninguna."""
    nombres = ["Fuera de las zonas"] * len(puntos)
    for z in zonas:
        for k, dentro in enumerate(_adentro(z.geometria, puntos)):
            if dentro and nombres[k] == "Fuera de las zonas":
                nombres[k] = z.nombre
    return nombres


def _filtros_zona(request):
    """(zonas, cuestionario, error) de ?zona=1,2&cuestionario=3. Las zonas
    quedan en el orden en que se eligieron."""
    ids = [z.strip() for z in request.GET.get("zona", "").split(",") if z.strip()]
    cuestionario_id = request.GET.get("cuestionario", "")
    if not ids or not all(z.isdigit() for z in ids) or not cuestionario_id.isdigit():
        return None, None, error("Seleccione al menos una zona y un cuestionario.")
    ids = list(dict.fromkeys(int(z) for z in ids))
    if len(ids) > MAXIMO_ZONAS:
        return None, None, error(f"Se pueden comparar hasta {MAXIMO_ZONAS} zonas a la vez.")
    por_id = {z.pk: z for z in Zona.objects.filter(pk__in=ids)}
    if len(por_id) != len(ids):
        return None, None, error("Alguna de las zonas elegidas no existe.", 404)
    cuestionario = cuestionarios_de_campana(request.campana).filter(pk=int(cuestionario_id)).first()
    if cuestionario is None:
        return None, None, error("El cuestionario no existe en esta campaña.", 404)
    return [por_id[i] for i in ids], cuestionario, None


def _color_zona(zona, k):
    color = (zona.color or "").strip()
    return color if len(color) == 7 and color.startswith("#") else COLORES_ZONAS[k % len(COLORES_ZONAS)]


def _datos_zonas(zonas, cuestionario):
    """Encuestas por zona y, por pregunta y opción, cuántas respuestas de cada
    zona. Devuelve (encuestas_por_zona, total_encuestas, sin_gps, reparto, preguntas)."""
    # Encuestas del cuestionario con su punto GPS. No se filtra por la campaña
    # de quien la cargó: el cuestionario ya es de esta campaña, quien administra
    # puede no tener campaña propia, y las respuestas (respuesta_cargada) tampoco
    # guardan campaña, así encuestas y respuestas cuentan lo mismo.
    encuestas = _filas("SELECT e.latitud, e.longitud FROM encuestas e WHERE e.id_cuestionario = %s", [cuestionario.pk])
    con_gps = [(la, ln) for la, ln in encuestas if la is not None and ln is not None]
    sin_gps = len(encuestas) - len(con_gps)
    por_zona = {z.pk: sum(_adentro(z.geometria, con_gps)) for z in zonas}

    reparto = {}
    for nombre in _zona_de(con_gps, Zona.objects.order_by("nombre")):
        reparto[nombre] = reparto.get(nombre, 0) + 1
    if sin_gps:
        reparto["Sin ubicación GPS"] = sin_gps

    opciones = _filas(
        """
        SELECT p.id_pregunta, p.orden, p.enunciado, p.tipo, o.id_opcion, o.texto
        FROM preguntas p JOIN opciones o ON o.id_pregunta = p.id_pregunta
        WHERE p.id_cuestionario = %s
        ORDER BY p.orden, o.orden
        """,
        [cuestionario.pk],
    )
    respuestas = _filas(
        """
        SELECT r.id_opcion, r.latitud, r.longitud
        FROM respuesta_cargada r
        JOIN opciones o ON o.id_opcion = r.id_opcion
        JOIN preguntas p ON p.id_pregunta = o.id_pregunta
        WHERE p.id_cuestionario = %s AND r.latitud IS NOT NULL AND r.longitud IS NOT NULL
        """,
        [cuestionario.pk],
    )
    puntos = [(la, ln) for _, la, ln in respuestas]
    cantidad = {}  # (id_zona, id_opcion) → respuestas
    for z in zonas:
        for (id_opcion, _, _), adentro in zip(respuestas, _adentro(z.geometria, puntos)):
            if adentro:
                cantidad[(z.pk, id_opcion)] = cantidad.get((z.pk, id_opcion), 0) + 1

    preguntas, por_id = [], {}
    for id_p, orden, enunciado, tipo, id_o, texto in opciones:
        p = por_id.get(id_p)
        if p is None:
            p = por_id[id_p] = {
                "id": id_p, "orden": orden, "enunciado": enunciado, "tipo": tipo,
                "multiple": tipo == "opcion_multiple", "opciones": [], "respuestas": 0,
            }
            preguntas.append(p)
        zonas_opcion = []
        for z in zonas:
            n = cantidad.get((z.pk, id_o), 0)
            # Porcentaje sobre las encuestas de esa zona (así se comparan zonas
            # de distinto tamaño; en opción múltiple no suman 100 %)
            zonas_opcion.append({"zona": z.pk, "cantidad": n,
                                 "porcentaje": round(100 * n / por_zona[z.pk], 1) if por_zona[z.pk] else 0})
        total = sum(x["cantidad"] for x in zonas_opcion)
        p["opciones"].append({"id": id_o, "texto": texto, "cantidad": total, "zonas": zonas_opcion})
        p["respuestas"] += total
    return por_zona, len(encuestas), sin_gps, reparto, preguntas


@require_GET
@requiere_permiso("core.view_encuesta")
def respuestas_por_zona(request):
    """GET ?zona=1,2&cuestionario= → por zona, las encuestas de ese cuestionario
    cargadas dentro de ella (según el GPS), y las preguntas con sus respuestas."""
    zonas, cuestionario, problema = _filtros_zona(request)
    if problema:
        return problema
    por_zona, total, sin_gps, reparto, preguntas = _datos_zonas(zonas, cuestionario)
    en_zonas = sum(por_zona.values())
    return JsonResponse({
        "zonas": [{"id": z.pk, "nombre": z.nombre, "color": _color_zona(z, k), "encuestas": por_zona[z.pk]}
                  for k, z in enumerate(zonas)],
        "cuestionario": {"id": cuestionario.pk, "titulo": cuestionario.titulo},
        "encuestas": en_zonas,
        "encuestas_cuestionario": total,
        "sin_gps": sin_gps,
        "reparto": [{"zona": z, "encuestas": n} for z, n in sorted(reparto.items(), key=lambda x: (-x[1], x[0]))],
        "preguntas": preguntas if en_zonas else [],
    })


def _comparacion_png(pregunta, zonas, oscuro):
    """Barras agrupadas: una fila por opción y una barra por zona con el % de
    las encuestas de esa zona que eligió la opción (y la cantidad)."""
    import io

    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np

    from . import graficos

    opciones = pregunta["opciones"][::-1]  # la primera opción arriba
    con_datos = [(k, z) for k, z in enumerate(zonas) if z["encuestas"]]
    n = max(len(con_datos), 1)
    alto_grupo = 0.8
    alto = alto_grupo / n
    figura, ax = plt.subplots(figsize=(8, max(2.6, 0.42 * len(opciones) * n + 1.2)), dpi=110)
    try:
        y = np.arange(len(opciones))
        tope = 1
        for j, (k, z) in enumerate(con_datos):
            valores = [o["zonas"][k]["porcentaje"] for o in opciones]
            cantidades = [o["zonas"][k]["cantidad"] for o in opciones]
            posiciones = y + alto_grupo / 2 - alto * (j + 0.5)
            ax.barh(posiciones, valores, height=alto * 0.9, color=z["color"], label=f"{z['nombre']} ({z['encuestas']})")
            tope = max(tope, *valores)
            for py, v, c in zip(posiciones, valores, cantidades):
                ax.text(v + 1, py, f"{graficos._numero(v)} % ({c})", va="center", fontsize=9, color=graficos.TINTA)
        ax.set_yticks(y, [graficos._recortar(o["texto"], 24) for o in opciones])
        ax.set_xlim(0, min(100, tope) * 1.25 if tope < 100 else 125)
        ax.set_xticks([t for t in range(0, 101, 20) if t <= max(tope, 20) * 1.25])
        ax.xaxis.grid(True, color=graficos.GRILLA)
        graficos._ejes_limpios(ax)
        ax.set_xlabel("% de las encuestas de cada zona", color=graficos.TINTA_SUAVE, fontsize=9)
        ax.legend(loc="lower center", bbox_to_anchor=(0.5, 1.0), ncol=min(n, 3), frameon=False, fontsize=9,
                  labelcolor=graficos.TINTA)
        figura.tight_layout()
        if oscuro:
            oscurecer(figura)
        salida = io.BytesIO()
        figura.savefig(salida, format="png", facecolor=figura.get_facecolor(), bbox_inches="tight")
        return salida.getvalue()
    finally:
        plt.close(figura)


@require_GET
@requiere_permiso("core.view_encuesta")
def grafico_zona(request, pregunta):
    """PNG de una pregunta con las respuestas de las zonas elegidas (GPS).
    Una zona: torta (una sola opción) o barras (opción múltiple), igual que
    Estadísticas. Varias zonas: barras agrupadas para compararlas."""
    import pandas as pd
    from django.shortcuts import get_object_or_404

    from . import graficos

    zonas, cuestionario, problema = _filtros_zona(request)
    if problema:
        return problema
    p = get_object_or_404(cuestionario.preguntas.prefetch_related("opciones"), pk=pregunta)
    oscuro = request.GET.get("tema") == "oscuro"
    por_zona, _, _, _, preguntas = _datos_zonas(zonas, cuestionario)
    dato = next(x for x in preguntas if x["id"] == p.pk)
    if dato["respuestas"] == 0:
        return error("No hay respuestas de esta pregunta en las zonas elegidas.", 404)

    if len(zonas) == 1:
        respuestas = pd.DataFrame(
            [(p.pk, o["id"]) for o in dato["opciones"] for _ in range(o["cantidad"])],
            columns=["pregunta", "opcion"],
        )
        tabla, _, respondidas = graficos.tabla_de(p, respuestas)
        png = graficos.grafico_png("barras" if p.tipo == "opcion_multiple" else "torta", tabla, respondidas, oscuro=oscuro)
    else:
        lista = [{"id": z.pk, "nombre": z.nombre, "color": _color_zona(z, k), "encuestas": por_zona[z.pk]}
                 for k, z in enumerate(zonas)]
        png = _comparacion_png(dato, lista, oscuro)
    respuesta = HttpResponse(png, content_type="image/png")
    respuesta["Cache-Control"] = "private, no-cache"
    return respuesta
