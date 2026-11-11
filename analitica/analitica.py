"""Módulo de Analítica (Parcial Nº 2 - M1).

Lee la base del proyecto (la misma Postgres de Neon que usa Django) con su
conector nativo (psycopg), transforma los datos con pandas, calcula con numpy
y genera los gráficos con matplotlib en analitica/salida/ (PNG).

Uso (desde la raíz del proyecto, con el venv del backend activado):

    python analitica/analitica.py
    python analitica/analitica.py --desde 2026-10-01 --hasta 2026-11-30
    python analitica/analitica.py --campana "Campaña Salta 2027" --meta 600

Parámetros (todos opcionales):
    --desde / --hasta   rango de fechas (AAAA-MM-DD). Sin --desde se toma el
                        inicio de la campaña o la primera encuesta; sin --hasta,
                        el fin de la campaña o la última encuesta.
    --campana           nombre o id de la campaña. Sin este parámetro: todas.
    --meta              encuestas que se quieren tener al final del período
                        (para el gráfico de evolución). Sin meta, ese gráfico
                        muestra solo lo real y la proyección.
    --salida            carpeta donde se guardan los PNG.

La conexión sale de DATABASE_URL (variable de entorno o backend/.env).

Gráficos que genera (cada uno responde una pregunta de negocio):
    1. Barras agrupadas: ¿cuántas encuestas carga cada equipo por semana?
    2. Donut:           ¿qué parte del total aportó cada equipo?
    3. Líneas:          ¿vamos a llegar a la meta de encuestas? (con proyección)
    4. Heatmap:         ¿en qué días y horarios se encuesta más?
    5. Dashboard:       resumen ejecutivo con los números clave.
"""

import argparse
import os
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

plt.rcParams.update({
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
})


# ---------------------------------------------------------------------------
# Parámetros y conexión
# ---------------------------------------------------------------------------


def leer_parametros():
    p = argparse.ArgumentParser(description="Gráficos de analítica de la consultora (PNG).")
    p.add_argument("--desde", type=date.fromisoformat, help="fecha inicial, AAAA-MM-DD")
    p.add_argument("--hasta", type=date.fromisoformat, help="fecha final, AAAA-MM-DD")
    p.add_argument("--campana", help="nombre o id de la campaña (por defecto: todas)")
    p.add_argument("--meta", type=int, help="encuestas a alcanzar al final del período")
    p.add_argument("--salida", type=Path, default=RAIZ / "analitica" / "salida", help="carpeta de los PNG")
    args = p.parse_args()
    if args.desde and args.hasta and args.desde > args.hasta:
        p.error("--desde no puede ser posterior a --hasta")
    if args.meta is not None and args.meta <= 0:
        p.error("--meta tiene que ser mayor que 0")
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
    campanas = consulta(conn, "SELECT id_campana, nombre, fecha_inicio, fecha_fin FROM campanas")
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


def rango_de_fechas(args, campana, df):
    """Rango del análisis: lo que se pidió, si no la campaña, si no los datos."""
    desde, hasta = args.desde, args.hasta
    if desde is None:
        desde = campana["fecha_inicio"] if campana is not None and pd.notna(campana["fecha_inicio"]) else None
    if hasta is None:
        hasta = campana["fecha_fin"] if campana is not None and pd.notna(campana["fecha_fin"]) else None
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


def grafico_barras(df, desde, hasta, colores, ax):
    """1. Barras agrupadas: encuestas por semana (o por mes si el período es
    largo) de cada equipo."""
    mensual = (hasta - desde).days > 120
    periodo = df["momento"].dt.tz_localize(None).dt.to_period("M" if mensual else "W-SUN").dt.start_time
    tabla = df.assign(periodo=periodo).pivot_table(
        index="periodo", columns="equipo", values="id_encuesta", aggfunc="count", fill_value=0
    )
    equipos = list(tabla.columns)
    ancho = 0.8 / len(equipos)
    x = np.arange(len(tabla))
    for i, equipo in enumerate(equipos):
        ax.bar(x + (i - (len(equipos) - 1) / 2) * ancho, tabla[equipo], ancho * 0.92,
               label=equipo, color=colores[equipo])
    ax.set_xticks(x)
    ax.set_xticklabels([p.strftime("%b %Y" if mensual else "%d/%m") for p in tabla.index])
    ax.set_xlabel("Mes" if mensual else "Semana (desde el lunes)")
    ax.set_ylabel("Encuestas")
    ax.grid(axis="y", color=GRILLA)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, ncol=min(len(equipos), 4))
    ax.set_title("Encuestas por equipo, " + ("por mes" if mensual else "por semana"), loc="left")


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


def grafico_evolucion(acumulado, tendencia, meta, hoy, ax):
    """3. Líneas: encuestas acumuladas contra la meta (sombreado verde si se
    está por encima, rojo si por debajo) y la proyección de la tendencia."""
    reales = acumulado[acumulado.index <= hoy]
    ax.plot(reales.index, reales, color=VIOLETA, linewidth=2.4, label="Encuestas acumuladas")
    if tendencia is not None:
        ax.plot(tendencia.index, tendencia, color=VIOLETA, linestyle=":", linewidth=1.6,
                label=f"Proyección al ritmo de los últimos 14 días (≈ {tendencia.iloc[-1]:,.0f})".replace(",", "."))
    if meta:
        objetivo = pd.Series(np.linspace(meta / len(acumulado), meta, len(acumulado)), index=acumulado.index)
        ax.plot(objetivo.index, objetivo, color=COLORES[3], linestyle="--", linewidth=1.6,
                label=f"Meta ({meta:,})".replace(",", "."))
        obj = objetivo[reales.index]
        ax.fill_between(reales.index, reales, obj, where=reales >= obj, color=VERDE, alpha=0.18,
                        interpolate=True, label="Sobre la meta")
        ax.fill_between(reales.index, reales, obj, where=reales < obj, color=ROJO, alpha=0.15,
                        interpolate=True, label="Debajo de la meta")
    ax.set_ylabel("Encuestas acumuladas")
    ax.grid(axis="y", color=GRILLA)
    ax.set_axisbelow(True)
    ax.legend(frameon=False, loc="upper left")
    ax.xaxis.set_major_formatter(matplotlib.dates.DateFormatter("%d/%m"))
    ax.set_title("Evolución de las encuestas" + (" contra la meta" if meta else ""), loc="left")


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


def dashboard(df, por_dia, acumulado, tendencia, meta, por_militante, medidas, colores, titulo, hoy):
    """5. Dashboard: números clave + acumulado + avance de la meta + top militantes."""
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

    # Avance de la meta (o participación por equipo si no hay meta)
    ax = fig.add_subplot(grilla[1, 2])
    if meta:
        avance = min(len(df) / meta, 1)
        ax.pie([avance, 1 - avance], colors=[VIOLETA, GRILLA], startangle=90, counterclock=False,
               wedgeprops={"width": 0.3})
        ax.text(0, 0, f"{len(df) / meta:.0%}".replace("%", " %"), ha="center", va="center", fontsize=22, fontweight="bold",
                color=TINTA)
        ax.set_title(f"Avance de la meta ({meta:,})".replace(",", "."), loc="left", fontsize=11)
    else:
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


# ---------------------------------------------------------------------------
# Programa
# ---------------------------------------------------------------------------


def main():
    args = leer_parametros()
    with conectar() as conn:
        campana = buscar_campana(conn, args.campana)
        todas = leer_encuestas(conn, campana)

    desde, hasta = rango_de_fechas(args, campana, todas)
    if desde is None:
        sys.exit("No hay encuestas cargadas para analizar.")
    df = filtrar(todas, desde, hasta)
    nombre = campana["nombre"] if campana is not None else "Todas las campañas"
    periodo = f"{desde:%d/%m/%Y} al {hasta:%d/%m/%Y}"
    print(f"Campaña: {nombre} · Período: {periodo}")
    if df.empty:
        sys.exit("No hay encuestas en ese período: no se generó ningún gráfico.")

    # Hoy (o el final del período, si ya pasó): lo real se dibuja hasta acá
    hoy = pd.Timestamp(min(datetime.now(ZONA).date(), hasta))
    por_dia, acumulado = serie_diaria(df, desde, hasta)
    tendencia = proyeccion(por_dia, acumulado, hoy)
    por_militante, medidas = medidas_por_militante(df)
    colores = colores_de(todas["equipo"].unique())

    args.salida.mkdir(parents=True, exist_ok=True)
    pie = f"{nombre} · {periodo} · generado el {datetime.now(ZONA):%d/%m/%Y %H:%M}"
    archivos = []

    fig, ax = plt.subplots(figsize=(12, 5))
    grafico_barras(df, desde, hasta, colores, ax)
    fig.text(0.01, -0.02, pie, color=TINTA_SUAVE, fontsize=8)
    archivos.append(guardar(fig, args.salida, "1_barras_equipos.png"))

    fig, ax = plt.subplots(figsize=(7, 6))
    grafico_donut(df, colores, ax)
    fig.text(0.01, 0.01, pie, color=TINTA_SUAVE, fontsize=8)
    archivos.append(guardar(fig, args.salida, "2_donut_equipos.png"))

    fig, ax = plt.subplots(figsize=(12, 5))
    grafico_evolucion(acumulado, tendencia, args.meta, hoy, ax)
    fig.text(0.01, -0.02, pie, color=TINTA_SUAVE, fontsize=8)
    archivos.append(guardar(fig, args.salida, "3_evolucion_meta.png"))

    fig, ax = plt.subplots(figsize=(12, 4.5))
    grafico_heatmap(df, fig, ax)
    fig.text(0.01, -0.04, pie, color=TINTA_SUAVE, fontsize=8)
    archivos.append(guardar(fig, args.salida, "4_heatmap_dia_hora.png"))

    fig = dashboard(df, por_dia, acumulado, tendencia, args.meta, por_militante, medidas, colores,
                    f"Tablero de campaña · {nombre}", hoy)
    fig.text(0.06, 0.01, pie, color=TINTA_SUAVE, fontsize=8)
    archivos.append(guardar(fig, args.salida, "5_dashboard.png"))

    # Resumen en consola
    print(f"Encuestas: {len(df)} · Militantes: {medidas['militantes']}")
    print(
        f"Encuestas por militante: media {medidas['media']:.1f}, mediana {medidas['mediana']:.1f}, "
        f"desvío {medidas['desvio']:.1f}, percentiles 25/75/90: "
        f"{medidas['p25']:.0f}/{medidas['p75']:.0f}/{medidas['p90']:.0f}"
    )
    if tendencia is not None:
        print(f"Proyección al {hasta:%d/%m/%Y}: ≈ {tendencia.iloc[-1]:.0f} encuestas"
              + (f" (meta {args.meta})" if args.meta else ""))
    for (militante, equipo), cantidad in medidas["inusuales"].items():
        print(f"Carga inusual (más de 2 desvíos sobre la media): {militante} ({equipo}) con {cantidad}")
    print("Gráficos generados:")
    for ruta in archivos:
        print(f"  {ruta}")


if __name__ == "__main__":
    main()
