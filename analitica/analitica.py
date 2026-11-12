"""Módulo de Analítica (Parcial Nº 2 - M1), que el sistema muestra en la
pantalla Dashboard.

Lee la base del proyecto (la misma Postgres de Neon que usa Django) con su
conector nativo (psycopg), transforma los datos con pandas, calcula con numpy
y genera los gráficos con matplotlib en analitica/salida/ (PNG).

Uso (desde la raíz del proyecto, con el venv del backend activado):

    python analitica/analitica.py
    python analitica/analitica.py --desde 2026-10-01 --hasta 2026-11-30
    python analitica/analitica.py --campana "Campaña Salta 2027" --cuestionario 3 --zona "Zona Norte"

Parámetros (todos opcionales):
    --desde / --hasta   rango de fechas (AAAA-MM-DD). Sin ellos se toma desde la
                        primera hasta la última encuesta.
    --campana           nombre o id de la campaña. Sin este parámetro: todas.
    --cuestionario      id del cuestionario para el gráfico de respuestas por zona.
    --zona              nombre o id de la zona (sin este parámetro: todas las zonas).
    --salida            carpeta donde se guardan los PNG.

La conexión sale de DATABASE_URL (variable de entorno o backend/.env).

Gráficos que genera (cada uno responde una pregunta de negocio):
    1. Barras:     ¿cuántas encuestas se cargan por período (día, semana o mes)?
    2. Donut:      ¿qué parte del total aportó cada equipo?
    3. Líneas:     ¿cómo crecen las encuestas y a cuánto se llegaría? (proyección)
    4. Heatmap:    ¿en qué días y horarios se encuesta más?
    5. Tablero:    resumen con los números clave.
    6. Respuestas: ¿qué se respondió en un cuestionario dentro de una zona?

Medidas (encuestas por militante, solo de quienes cargaron en el período):
    media = suma / cantidad; mediana = valor central; desvío estándar muestral
    (n - 1); percentiles 25, 75 y 90 con interpolación lineal (numpy).
"""

import argparse
import json
import os
import textwrap
import sys
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

import matplotlib

matplotlib.use("Agg")  # sin ventanas: solo se generan imágenes

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import psycopg  # noqa: E402
from matplotlib.gridspec import GridSpec  # noqa: E402
from matplotlib.path import Path as Trazo  # noqa: E402
from matplotlib.ticker import MaxNLocator  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
# La base guarda las fechas en UTC: se pasan a la hora de Argentina para
# agrupar por día y hora (si no, el heatmap queda corrido 3 horas)
ZONA = ZoneInfo("America/Argentina/Salta")

# Colores del proyecto (los mismos que backend/core/graficos.py)
VIOLETA = "#51318f"
COLORES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
TINTA = "#15121c"
TINTA_SUAVE = "#5d5a66"
GRILLA = "#ecebf0"
VERDE, ROJO = "#1baf7a", "#e34948"
DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

# Estilo de los gráficos. Se aplica solo mientras se dibujan (plt.rc_context),
# así no cambia los gráficos de Estadísticas cuando el sistema usa este módulo.
ESTILO = {
    "font.size": 10,
    "axes.edgecolor": GRILLA,
    "axes.labelcolor": TINTA_SUAVE,
    "axes.titlecolor": TINTA,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "xtick.color": TINTA_SUAVE,
    "ytick.color": TINTA_SUAVE,
    "figure.facecolor": "white",
}

# Gráficos de encuestas: clave → nombre del archivo PNG
GRAFICOS = {
    "periodo": "1_encuestas_por_periodo.png",
    "donut": "2_participacion_equipos.png",
    "evolucion": "3_evolucion.png",
    "heatmap": "4_dias_y_horarios.png",
    "dashboard": "5_tablero.png",
}
# Gráfico de respuestas de un cuestionario en una zona
RESPUESTAS = "6_respuestas_por_zona.png"


# ---------------------------------------------------------------------------
# Parámetros y conexión
# ---------------------------------------------------------------------------


def leer_parametros():
    p = argparse.ArgumentParser(description="Gráficos de analítica de la consultora (PNG).")
    p.add_argument("--desde", type=date.fromisoformat, help="fecha inicial, AAAA-MM-DD")
    p.add_argument("--hasta", type=date.fromisoformat, help="fecha final, AAAA-MM-DD")
    p.add_argument("--campana", help="nombre o id de la campaña (por defecto: todas)")
    p.add_argument("--cuestionario", type=int, help="id del cuestionario para el gráfico de respuestas por zona")
    p.add_argument("--zona", help="nombre o id de la zona (por defecto: todas)")
    p.add_argument("--salida", type=Path, default=RAIZ / "analitica" / "salida", help="carpeta de los PNG")
    args = p.parse_args()
    if args.desde and args.hasta and args.desde > args.hasta:
        p.error("--desde no puede ser posterior a --hasta")
    return args


def conectar():
    """Conexión con psycopg a la DATABASE_URL del backend (Neon)."""
    if "DATABASE_URL" not in os.environ:
        try:
            from dotenv import load_dotenv

            load_dotenv(RAIZ / "backend" / ".env")
        except ImportError:
            pass
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("Falta DATABASE_URL (en backend/.env o como variable de entorno).")
    return psycopg.connect(url)


def consulta(conn, sql, parametros=None):
    """Ejecuta una consulta y devuelve un DataFrame con sus columnas."""
    with conn.cursor() as cur:
        cur.execute(sql, parametros or {})
        columnas = [c.name for c in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=columnas)


# ---------------------------------------------------------------------------
# Datos
# ---------------------------------------------------------------------------


def buscar_campana(conn, valor):
    """Campaña por id o por nombre (sin distinguir mayúsculas). None = todas."""
    if valor is None:
        return None
    campanas = consulta(conn, "SELECT id_campana, nombre FROM campanas")
    if valor.isdigit():
        elegida = campanas[campanas["id_campana"] == int(valor)]
    else:
        elegida = campanas[campanas["nombre"].str.lower() == valor.strip().lower()]
    if elegida.empty:
        sys.exit(f'No existe la campaña "{valor}". Campañas: {", ".join(campanas["nombre"])}')
    return elegida.iloc[0]


def leer_encuestas(conn, campana):
    """Una fila por encuesta: cuándo, qué militante la cargó y de qué equipo.

    Cruza encuestas → usuarios → equipos. La campaña de la encuesta es la del
    militante que la cargó (como en el sistema)."""
    sql = """
        SELECT e.id_encuesta,
               e.realizada_en,
               u.id AS id_usuario,
               COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email) AS militante,
               COALESCE(eq.nombre, 'Sin equipo') AS equipo,
               u.id_campana
        FROM encuestas e
        JOIN usuarios u ON u.id = e.id_usuario
        LEFT JOIN equipos eq ON eq.id_equipo = u.id_equipo
    """
    parametros = {}
    if campana is not None:
        sql += " WHERE u.id_campana = %(campana)s"
        parametros["campana"] = int(campana["id_campana"])
    df = consulta(conn, sql, parametros)
    # Fecha y hora locales (Argentina)
    df["momento"] = pd.to_datetime(df["realizada_en"], utc=True).dt.tz_convert(ZONA)
    return df


def leer_respuestas(conn, id_cuestionario):
    """Una fila por opción de cada pregunta del cuestionario y, si la eligieron,
    una por cada respuesta cargada (con la ubicación del celular). Las opciones
    sin respuestas quedan con id_respuesta vacío, para mostrarlas en 0.

    La respuesta llega a su cuestionario por respuesta_cargada → opciones →
    preguntas → cuestionarios."""
    df = consulta(
        conn,
        """
        SELECT p.id_pregunta, p.orden AS orden_pregunta, p.enunciado,
               o.id_opcion, o.orden AS orden_opcion, o.texto AS opcion,
               r.id_respuesta, r.latitud, r.longitud
        FROM preguntas p
        JOIN opciones o ON o.id_pregunta = p.id_pregunta
        LEFT JOIN respuesta_cargada r ON r.id_opcion = o.id_opcion
        WHERE p.id_cuestionario = %(cuestionario)s
        ORDER BY p.orden, o.orden
        """,
        {"cuestionario": int(id_cuestionario)},
    )
    for columna in ("latitud", "longitud"):
        df[columna] = pd.to_numeric(df[columna], errors="coerce")
    return df


def leer_zonas(conn):
    """Zonas del mapa con su polígono (GeoJSON)."""
    zonas = consulta(conn, "SELECT id_zona, nombre, geometria FROM zonas ORDER BY nombre")
    # Según el conector, el JSON llega como texto o ya convertido
    zonas["geometria"] = zonas["geometria"].map(lambda g: json.loads(g) if isinstance(g, str) else g)
    return zonas


def buscar_zona(zonas, valor):
    """Zona por id o por nombre (sin distinguir mayúsculas). None = todas."""
    if valor is None:
        return None
    valor = str(valor).strip()
    if valor.isdigit():
        elegida = zonas[zonas["id_zona"] == int(valor)]
    else:
        elegida = zonas[zonas["nombre"].str.lower() == valor.lower()]
    if elegida.empty:
        raise ValueError(f'No existe la zona "{valor}".')
    return elegida.iloc[0]


def dentro_de(geometria, latitudes, longitudes):
    """Máscara de los puntos que caen dentro del polígono GeoJSON (Polygon o
    MultiPolygon, con sus huecos). Usa matplotlib.path para no sumar otra
    librería."""
    if geometria and geometria.get("type") == "Feature":
        geometria = geometria.get("geometry")
    if not geometria:
        return np.zeros(len(latitudes), dtype=bool)
    poligonos = (
        [geometria["coordinates"]] if geometria["type"] == "Polygon"
        else geometria["coordinates"] if geometria["type"] == "MultiPolygon" else []
    )
    puntos = np.column_stack([longitudes, latitudes])
    mascara = np.zeros(len(puntos), dtype=bool)
    for anillos in poligonos:
        adentro = Trazo(np.asarray(anillos[0])[:, :2]).contains_points(puntos)
        for hueco in anillos[1:]:
            adentro &= ~Trazo(np.asarray(hueco)[:, :2]).contains_points(puntos)
        mascara |= adentro
    return mascara


def numero(texto):
    """"4", "4,5" o "4.5" → número; None si no es un número (como el sistema)."""
    try:
        return float(str(texto).strip().replace(",", "."))
    except ValueError:
        return None


def medidas_de_valores(valores, cantidades):
    """Media, mediana y desvío de una variable cuantitativa a partir de cuántas
    veces se eligió cada valor."""
    datos = np.repeat(np.asarray(valores, dtype=float), np.asarray(cantidades, dtype=int))
    if datos.size == 0:
        return None
    return {
        "media": float(np.mean(datos)),
        "mediana": float(np.median(datos)),
        "desvio": float(np.std(datos, ddof=1)) if datos.size > 1 else 0.0,
    }


def rango_de_fechas(args, df):
    """Rango del análisis: lo que se pidió o, si no, de la primera a la última encuesta."""
    desde, hasta = args.desde, args.hasta
    if not df.empty:
        desde = desde or df["momento"].min().date()
        hasta = hasta or df["momento"].max().date()
    return desde, hasta


def filtrar(df, desde, hasta):
    inicio = datetime.combine(desde, time.min, ZONA)
    fin = datetime.combine(hasta, time.max, ZONA)
    return df[(df["momento"] >= inicio) & (df["momento"] <= fin)].copy()


# ---------------------------------------------------------------------------
# Cálculos (numpy)
# ---------------------------------------------------------------------------


def medidas_por_militante(df):
    """Encuestas por militante y sus medidas: media, mediana, desvío y
    percentiles. Marca a quien está más de 2 desvíos sobre la media (carga
    inusual, para revisar)."""
    por_militante = df.groupby(["militante", "equipo"]).size().sort_values(ascending=False)
    valores = por_militante.to_numpy()
    media = float(np.mean(valores))
    desvio = float(np.std(valores, ddof=1)) if valores.size > 1 else 0.0
    medidas = {
        "militantes": int(valores.size),
        "media": media,
        "mediana": float(np.median(valores)),
        "desvio": desvio,
        "p25": float(np.percentile(valores, 25)),
        "p75": float(np.percentile(valores, 75)),
        "p90": float(np.percentile(valores, 90)),
        "inusuales": por_militante[valores > media + 2 * desvio] if desvio else por_militante.iloc[:0],
    }
    return por_militante, medidas


def serie_diaria(df, desde, hasta):
    """Encuestas por día (los días sin encuestas quedan en 0) y su acumulado."""
    dias = pd.date_range(desde, hasta, freq="D")
    por_dia = df.groupby(df["momento"].dt.date).size()
    por_dia.index = pd.to_datetime(por_dia.index)
    por_dia = por_dia.reindex(dias, fill_value=0)
    return por_dia, por_dia.cumsum()


def proyeccion(por_dia, acumulado, hoy, dias_ritmo=14):
    """Proyección desde lo cargado hasta hoy hasta el final del período, al
    ritmo promedio (numpy.mean) de los últimos `dias_ritmo` días. Si el
    período ya terminó, no hay nada que proyectar (None)."""
    if hoy >= acumulado.index[-1]:
        return None
    ritmo = float(np.mean(por_dia[por_dia.index <= hoy].tail(dias_ritmo).to_numpy()))
    futuro = acumulado.index[acumulado.index >= hoy]
    dias = np.arange(len(futuro))
    return pd.Series(acumulado[hoy] + ritmo * dias, index=futuro)


# ---------------------------------------------------------------------------
# Gráficos (matplotlib)
# ---------------------------------------------------------------------------


def colores_de(equipos):
    return {e: COLORES[i % len(COLORES)] for i, e in enumerate(sorted(equipos))}


def guardar(fig, carpeta, nombre):
    ruta = carpeta / nombre
    fig.savefig(ruta, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return ruta


def periodicidad(desde, hasta):
    """Día si el período es de hasta un mes, semana hasta seis meses y si no mes."""
    dias = (hasta - desde).days + 1
    if dias <= 31:
        return "D", "día"
    if dias <= 183:
        return "W-SUN", "semana"
    return "M", "mes"


def etiqueta_periodo(inicio, frecuencia):
    if frecuencia == "M":
        return f"{MESES[inicio.month - 1]} {inicio:%Y}"
    return f"{inicio:%d/%m}"


def grafico_periodo(df, desde, hasta, ax):
    """1. Barras: encuestas cargadas en cada período (día, semana o mes según
    el largo del rango), con los períodos sin encuestas en 0 y el promedio."""
    frecuencia, nombre = periodicidad(desde, hasta)
    periodos = pd.period_range(desde, hasta, freq=frecuencia)
    por_periodo = (
        df["momento"].dt.tz_localize(None).dt.to_period(frecuencia).value_counts().reindex(periodos, fill_value=0)
    )
    valores = por_periodo.to_numpy()
    x = np.arange(len(valores))
    ax.bar(x, valores, color=VIOLETA, alpha=0.88, width=0.72)
    if len(valores) <= 40:
        for i, v in enumerate(valores):
            if v:
                ax.text(i, v, f"{v}", ha="center", va="bottom", fontsize=8, color=TINTA)
    promedio = float(np.mean(valores))
    ax.axhline(promedio, color=COLORES[3], linestyle="--", linewidth=1.4,
               label=f"Promedio por {nombre}: {promedio:.1f}".replace(".", ","))
    paso = max(1, len(valores) // 16)
    ax.set_xticks(x[::paso])
    ax.set_xticklabels([etiqueta_periodo(p.start_time, frecuencia) for p in periodos[::paso]])
    ax.set_xlabel({"día": "Día", "semana": "Semana (desde el lunes)", "mes": "Mes"}[nombre])
    ax.set_ylabel("Encuestas")
    ax.grid(axis="y", color=GRILLA)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper left")
    ax.set_title(f"Encuestas por {nombre}", loc="left")


def grafico_donut(df, colores, ax):
    """2. Donut: qué parte del total de encuestas aportó cada equipo."""
    por_equipo = df["equipo"].value_counts()
    ax.pie(
        por_equipo, labels=por_equipo.index, colors=[colores[e] for e in por_equipo.index],
        autopct=lambda p: f"{p:.1f} %".replace(".", ","), pctdistance=0.78, startangle=90, counterclock=False,
        wedgeprops={"width": 0.38, "edgecolor": "white", "linewidth": 2},
        textprops={"color": TINTA},
    )
    ax.text(0, 0.06, f"{len(df):,}".replace(",", "."), ha="center", va="center",
            fontsize=22, fontweight="bold", color=TINTA)
    ax.text(0, -0.16, "encuestas", ha="center", va="center", color=TINTA_SUAVE)
    ax.set_title("Participación de cada equipo en el total", loc="left")


def grafico_evolucion(acumulado, tendencia, hoy, ax):
    """3. Líneas: encuestas acumuladas día a día y la proyección hasta el final
    del período al ritmo de los últimos 14 días."""
    reales = acumulado[acumulado.index <= hoy]
    ax.fill_between(reales.index, reales, color=VIOLETA, alpha=0.12)
    ax.plot(reales.index, reales, color=VIOLETA, linewidth=2.4, label="Encuestas acumuladas")
    if tendencia is not None:
        ax.plot(tendencia.index, tendencia, color=VIOLETA, linestyle=":", linewidth=1.6,
                label=f"Proyección al ritmo de los últimos 14 días (≈ {tendencia.iloc[-1]:,.0f})".replace(",", "."))
    ax.set_ylabel("Encuestas acumuladas")
    ax.grid(axis="y", color=GRILLA)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper left")
    ax.xaxis.set_major_formatter(matplotlib.dates.DateFormatter("%d/%m"))
    ax.set_title("Evolución de las encuestas", loc="left")


def grafico_heatmap(df, fig, ax):
    """4. Heatmap: encuestas por día de la semana y hora (hora de Argentina)."""
    horas = range(int(df["momento"].dt.hour.min()), int(df["momento"].dt.hour.max()) + 1)
    tabla = (
        df.assign(dia=df["momento"].dt.day_of_week, hora=df["momento"].dt.hour)
        .pivot_table(index="dia", columns="hora", values="id_encuesta", aggfunc="count", fill_value=0)
        .reindex(index=range(7), columns=horas, fill_value=0)
    )
    matriz = tabla.to_numpy()
    imagen = ax.imshow(matriz, cmap="Purples", aspect="auto")
    tope = matriz.max() or 1
    for i in range(matriz.shape[0]):
        for j in range(matriz.shape[1]):
            if matriz[i, j]:
                ax.text(j, i, int(matriz[i, j]), ha="center", va="center", fontsize=8,
                        color="white" if matriz[i, j] > tope * 0.55 else TINTA)
    ax.set_yticks(range(7))
    ax.set_yticklabels(DIAS)
    ax.set_xticks(range(len(horas)))
    ax.set_xticklabels([f"{h:02d}" for h in horas])
    ax.set_xlabel("Hora (Argentina)")
    ax.spines[:].set_visible(False)
    barra = fig.colorbar(imagen, ax=ax, fraction=0.03, pad=0.02)
    barra.set_label("Encuestas")
    barra.outline.set_visible(False)
    ax.set_title("¿Cuándo se encuesta? Encuestas por día y hora", loc="left")


def dashboard(df, por_dia, acumulado, tendencia, por_militante, medidas, colores, titulo, hoy):
    """5. Tablero: números clave + acumulado + encuestas por equipo + top militantes."""
    fig = plt.figure(figsize=(14, 8.5))
    grilla = GridSpec(3, 3, figure=fig, height_ratios=[0.55, 1.6, 1.6], hspace=0.55, wspace=0.3)
    fig.suptitle(titulo, x=0.06, ha="left", fontsize=17, fontweight="bold", color=TINTA)

    # Números clave
    activos = por_dia[por_dia.index <= hoy]
    numeros = [
        (f"{len(df):,}".replace(",", "."), "encuestas en el período"),
        (str(medidas["militantes"]), "militantes que cargaron"),
        (f"{medidas['media']:.1f}".replace(".", ","), "encuestas por militante (media)"),
        (f"{activos.mean():.1f}".replace(".", ","), "encuestas por día (media)"),
    ]
    caja = fig.add_subplot(grilla[0, :])
    caja.axis("off")
    for i, (valor, texto) in enumerate(numeros):
        caja.text(i / 4, 0.62, valor, fontsize=24, fontweight="bold", color=VIOLETA, transform=caja.transAxes)
        caja.text(i / 4, 0.05, texto, color=TINTA_SUAVE, transform=caja.transAxes)

    # Acumulado
    ax = fig.add_subplot(grilla[1, :2])
    reales = acumulado[acumulado.index <= hoy]
    ax.fill_between(reales.index, reales, color=VIOLETA, alpha=0.18)
    ax.plot(reales.index, reales, color=VIOLETA, linewidth=2)
    if tendencia is not None:
        ax.plot(tendencia.index, tendencia, color=VIOLETA, linestyle=":", linewidth=1.4)
    ax.xaxis.set_major_formatter(matplotlib.dates.DateFormatter("%d/%m"))
    ax.grid(axis="y", color=GRILLA)
    ax.set_title("Encuestas acumuladas", loc="left", fontsize=11)

    # Encuestas por equipo
    ax = fig.add_subplot(grilla[1, 2])
    por_equipo = df["equipo"].value_counts()
    ax.pie(por_equipo, colors=[colores[e] for e in por_equipo.index], startangle=90,
           counterclock=False, wedgeprops={"width": 0.3, "edgecolor": "white"})
    ax.legend(por_equipo.index, frameon=False, loc="center", fontsize=8)
    ax.set_title("Encuestas por equipo", loc="left", fontsize=11)

    # Top 5 militantes
    ax = fig.add_subplot(grilla[2, :2])
    top = por_militante.head(5).iloc[::-1]
    nombres = [f"{m} · {e}" for m, e in top.index]
    ax.barh(nombres, top.to_numpy(), color=VIOLETA, alpha=0.85)
    for i, v in enumerate(top.to_numpy()):
        ax.text(v, i, f" {v}", va="center", color=TINTA)
    ax.axvline(medidas["media"], color=TINTA_SUAVE, linestyle="--", linewidth=1)
    ax.text(medidas["media"], len(top) - 0.4, " media", color=TINTA_SUAVE, fontsize=8)
    ax.set_title("Top 5 militantes", loc="left", fontsize=11)

    # Encuestas por día de la semana
    ax = fig.add_subplot(grilla[2, 2])
    por_semana = df["momento"].dt.day_of_week.value_counts().reindex(range(7), fill_value=0)
    ax.bar(DIAS, por_semana.to_numpy(), color=VIOLETA, alpha=0.85)
    ax.grid(axis="y", color=GRILLA)
    ax.set_axisbelow(True)
    ax.set_title("Por día de la semana", loc="left", fontsize=11)
    return fig


def figura(clave, todas, desde, hasta, nombre="Todas las campañas"):
    """Arma uno de los GRAFICOS (Figure de matplotlib) con las encuestas de
    `todas` que caen en el período. None si en el período no hay encuestas.
    La usan este script y la pantalla Dashboard del sistema."""
    df = filtrar(todas, desde, hasta)
    if df.empty:
        return None
    # Hoy (o el final del período, si ya pasó): lo real se dibuja hasta acá
    hoy = pd.Timestamp(min(datetime.now(ZONA).date(), hasta))
    por_dia, acumulado = serie_diaria(df, desde, hasta)
    tendencia = proyeccion(por_dia, acumulado, hoy)
    colores = colores_de(todas["equipo"].unique())
    pie = f"{nombre} · {desde:%d/%m/%Y} al {hasta:%d/%m/%Y} · generado el {datetime.now(ZONA):%d/%m/%Y %H:%M}"

    with plt.rc_context(ESTILO):
        if clave == "periodo":
            fig, ax = plt.subplots(figsize=(12, 5))
            grafico_periodo(df, desde, hasta, ax)
            fig.text(0.01, -0.02, pie, color=TINTA_SUAVE, fontsize=8)
        elif clave == "donut":
            fig, ax = plt.subplots(figsize=(7, 6))
            grafico_donut(df, colores, ax)
            fig.text(0.01, 0.01, pie, color=TINTA_SUAVE, fontsize=8)
        elif clave == "evolucion":
            fig, ax = plt.subplots(figsize=(12, 5))
            grafico_evolucion(acumulado, tendencia, hoy, ax)
            fig.text(0.01, -0.02, pie, color=TINTA_SUAVE, fontsize=8)
        elif clave == "heatmap":
            fig, ax = plt.subplots(figsize=(12, 4.5))
            grafico_heatmap(df, fig, ax)
            fig.text(0.01, -0.04, pie, color=TINTA_SUAVE, fontsize=8)
        elif clave == "dashboard":
            por_militante, medidas = medidas_por_militante(df)
            fig = dashboard(df, por_dia, acumulado, tendencia, por_militante, medidas, colores,
                            f"Tablero de campaña · {nombre}", hoy)
            fig.text(0.06, 0.01, pie, color=TINTA_SUAVE, fontsize=8)
        else:
            raise ValueError(f"No existe el gráfico {clave!r}")
    return fig


def figura_respuestas(respuestas, titulo, zona=None, nombre="Todas las campañas"):
    """6. Barras por pregunta: cuántas veces se eligió cada opción del
    cuestionario en la zona (o en todas). Solo cuentan las respuestas con la
    ubicación del celular. En las preguntas cuantitativas (opciones numéricas)
    se agregan media, mediana y desvío. None si no hay respuestas para mostrar."""
    cargadas = respuestas[respuestas["id_respuesta"].notna()]
    con_ubicacion = cargadas[cargadas["latitud"].notna() & cargadas["longitud"].notna()]
    if zona is not None:
        con_ubicacion = con_ubicacion[
            dentro_de(zona["geometria"], con_ubicacion["latitud"].to_numpy(), con_ubicacion["longitud"].to_numpy())
        ]
    if con_ubicacion.empty:
        return None

    preguntas = respuestas.drop_duplicates("id_pregunta")[["id_pregunta", "orden_pregunta", "enunciado"]]
    opciones = respuestas.drop_duplicates("id_opcion")
    conteo = con_ubicacion["id_opcion"].value_counts()
    altos = [max(1.4, 0.38 * (opciones["id_pregunta"] == p).sum() + 0.9) for p in preguntas["id_pregunta"]]
    lugar = f"en {zona['nombre']}" if zona is not None else "en todas las zonas"

    with plt.rc_context(ESTILO):
        fig = plt.figure(figsize=(11, sum(altos) + 1.3))
        grilla = GridSpec(len(altos), 1, figure=fig, height_ratios=altos, hspace=0.75)
        fig.suptitle(f"Respuestas de «{titulo}» {lugar}", x=0.02, ha="left",
                     fontsize=15, fontweight="bold", color=TINTA)
        for i, (_, pregunta) in enumerate(preguntas.iterrows()):
            ax = fig.add_subplot(grilla[i])
            suyas = opciones[opciones["id_pregunta"] == pregunta["id_pregunta"]]
            cantidades = suyas["id_opcion"].map(conteo).fillna(0).astype(int).to_numpy()
            total = int(cantidades.sum())
            textos = [textwrap.shorten(str(t), 42, placeholder="…") for t in suyas["opcion"]]
            y = np.arange(len(textos))[::-1]
            ax.barh(y, cantidades, color=VIOLETA, alpha=0.88, height=0.62)
            for yy, c in zip(y, cantidades):
                porcentaje = f"{c / total:.0%}".replace("%", " %") if total else "0 %"
                ax.text(c, yy, f"  {c} ({porcentaje})", va="center", fontsize=9, color=TINTA)
            ax.set_yticks(y)
            ax.set_yticklabels(textos)
            ax.set_xlim(0, max(1, cantidades.max()) * 1.25)
            ax.xaxis.set_major_locator(MaxNLocator(integer=True))
            ax.grid(axis="x", color=GRILLA)
            ax.set_axisbelow(True)
            enunciado = textwrap.shorten(str(pregunta["enunciado"]), 90, placeholder="…")
            ax.set_title(f"{int(pregunta['orden_pregunta'])}. {enunciado}", loc="left", fontsize=11)
            valores = [numero(t) for t in suyas["opcion"]]
            detalle = f"{total} respuesta{'s' if total != 1 else ''}"
            if all(v is not None for v in valores) and total:
                m = medidas_de_valores(valores, cantidades)
                detalle += (
                    f" · media {m['media']:.2f} · mediana {m['mediana']:.2f} · desvío {m['desvio']:.2f}"
                ).replace(".", ",")
            ax.set_title(detalle, loc="right", fontsize=9, color=TINTA_SUAVE)
        sin_ubicacion = len(cargadas) - int(cargadas["latitud"].notna().sum())
        pie = f"{nombre} · todas las fechas · generado el {datetime.now(ZONA):%d/%m/%Y %H:%M}"
        if sin_ubicacion:
            pie += f" · {sin_ubicacion} respuestas anteriores sin ubicación no se cuentan"
        fig.text(0.02, 0.005, pie, color=TINTA_SUAVE, fontsize=8)
    return fig


# ---------------------------------------------------------------------------
# Programa
# ---------------------------------------------------------------------------


def main():
    args = leer_parametros()
    with conectar() as conn:
        campana = buscar_campana(conn, args.campana)
        todas = leer_encuestas(conn, campana)

    desde, hasta = rango_de_fechas(args, todas)
    if desde is None:
        sys.exit("No hay encuestas cargadas para analizar.")
    df = filtrar(todas, desde, hasta)
    nombre = campana["nombre"] if campana is not None else "Todas las campañas"
    periodo = f"{desde:%d/%m/%Y} al {hasta:%d/%m/%Y}"
    print(f"Campaña: {nombre} · Período: {periodo}")
    if df.empty:
        sys.exit("No hay encuestas en ese período: no se generó ningún gráfico.")

    args.salida.mkdir(parents=True, exist_ok=True)
    archivos = [
        guardar(figura(clave, todas, desde, hasta, nombre), args.salida, archivo)
        for clave, archivo in GRAFICOS.items()
    ]
    if args.cuestionario:
        with conectar() as conn:
            respuestas = leer_respuestas(conn, args.cuestionario)
            titulo = consulta(conn, "SELECT titulo FROM cuestionarios WHERE id_cuestionario = %(c)s",
                              {"c": args.cuestionario})
            try:
                zona = buscar_zona(leer_zonas(conn), args.zona)
            except ValueError as e:
                sys.exit(str(e))
        if titulo.empty:
            sys.exit(f"No existe el cuestionario {args.cuestionario}.")
        fig = figura_respuestas(respuestas, titulo.iloc[0]["titulo"], zona, nombre)
        if fig is None:
            print("No hay respuestas con ubicación para ese cuestionario y zona.")
        else:
            archivos.append(guardar(fig, args.salida, RESPUESTAS))

    # Para el resumen en consola
    hoy = pd.Timestamp(min(datetime.now(ZONA).date(), hasta))
    por_dia, acumulado = serie_diaria(df, desde, hasta)
    tendencia = proyeccion(por_dia, acumulado, hoy)
    _, medidas = medidas_por_militante(df)

    # Resumen en consola
    print(f"Encuestas: {len(df)} · Militantes: {medidas['militantes']}")
    print(
        f"Encuestas por militante: media {medidas['media']:.1f}, mediana {medidas['mediana']:.1f}, "
        f"desvío {medidas['desvio']:.1f}, percentiles 25/75/90: "
        f"{medidas['p25']:.0f}/{medidas['p75']:.0f}/{medidas['p90']:.0f}"
    )
    if tendencia is not None:
        print(f"Proyección al {hasta:%d/%m/%Y}: ≈ {tendencia.iloc[-1]:.0f} encuestas")
    for (militante, equipo), cantidad in medidas["inusuales"].items():
        print(f"Carga inusual (más de 2 desvíos sobre la media): {militante} ({equipo}) con {cantidad}")
    print("Gráficos generados:")
    for ruta in archivos:
        print(f"  {ruta}")


if __name__ == "__main__":
    main()
