"""Estadísticas con pandas y gráficos con matplotlib.

Las respuestas de un cuestionario se cargan en un DataFrame (una fila por
opción elegida) y de ahí salen las frecuencias, las medidas y las imágenes PNG
que muestra la pantalla de Estadísticas.
"""

import io

import matplotlib

matplotlib.use("Agg")  # sin ventanas: solo se generan imágenes en el servidor

import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from .models import Pregunta, RespuestaCargada, numero_de  # noqa: E402

# Paleta categórica (la misma que usaba el frontend), en orden fijo
CATEGORICOS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
GRIS_OTRAS = "#8a8794"
VIOLETA = "#51318f"
TINTA = "#15121c"
TINTA_SUAVE = "#5d5a66"
GRILLA = "#ecebf0"

GRAFICOS = ("barras", "columnas", "linea", "torta", "distribucion")


def respuestas_de(cuestionario):
    """DataFrame con una fila por opción elegida: encuesta, pregunta y opción."""
    filas = RespuestaCargada.objects.filter(pregunta__cuestionario=cuestionario).values_list(
        "encuesta_id", "pregunta_id", "opcion_id"
    )
    return pd.DataFrame(list(filas), columns=["encuesta", "pregunta", "opcion"])


def tabla_de(pregunta, respuestas):
    """Tabla de frecuencias de una pregunta: una fila por opción, en su orden
    (las cuantitativas, de menor a mayor valor)."""
    opciones = list(pregunta.opciones.all())
    variable = Pregunta.variable_de(o.texto for o in opciones)
    propias = respuestas[respuestas["pregunta"] == pregunta.pk]
    conteo = propias["opcion"].value_counts()

    tabla = pd.DataFrame({"id": [o.pk for o in opciones], "texto": [o.texto for o in opciones]})
    tabla["cantidad"] = tabla["id"].map(conteo).fillna(0).astype(int)
    if variable == Pregunta.Variable.CUANTITATIVA:
        tabla["valor"] = tabla["texto"].map(numero_de).astype(float)
        tabla = tabla.sort_values("valor", kind="stable").reset_index(drop=True)
    return tabla, variable, int(propias["encuesta"].nunique())


def medidas(tabla):
    """Media, mediana, moda, desvío, mínimo, máximo y rango de una variable cuantitativa."""
    valores = tabla["valor"].repeat(tabla["cantidad"])
    if valores.empty:
        return None
    frecuencias = valores.value_counts()
    # Puede haber más de una moda; si ningún valor se repite, no hay moda
    sin_moda = frecuencias.max() == 1 and len(frecuencias) > 1
    numero = lambda v: int(v) if float(v).is_integer() else round(float(v), 2)  # noqa: E731
    return {
        "n": int(valores.size),
        "media": round(float(valores.mean()), 2),
        "mediana": round(float(valores.median()), 2),
        "moda": [] if sin_moda else [numero(v) for v in sorted(valores.mode())],
        "desvio": round(float(valores.std()), 2) if valores.size > 1 else 0,
        "minimo": numero(valores.min()),
        "maximo": numero(valores.max()),
        "rango": numero(valores.max() - valores.min()),
    }


# ---------------------------------------------------------------------------
# Gráficos (matplotlib)
# ---------------------------------------------------------------------------


def _con_colores(tabla):
    tabla = tabla.copy()
    tabla["color"] = [CATEGORICOS[i % len(CATEGORICOS)] for i in range(len(tabla))]
    return tabla


def _partes(tabla):
    """Opciones con respuestas; si son más de 8, las más chicas se juntan en "Otras"."""
    partes = _con_colores(tabla)
    partes = partes[partes["cantidad"] > 0]
    if len(partes) > len(CATEGORICOS):
        quedan = partes.nlargest(len(CATEGORICOS) - 1, "cantidad").index
        otras = pd.DataFrame([{"texto": "Otras", "cantidad": partes.drop(quedan)["cantidad"].sum(), "color": GRIS_OTRAS}])
        partes = pd.concat([partes.loc[sorted(quedan)], otras], ignore_index=True)
    partes["parte"] = 100 * partes["cantidad"] / partes["cantidad"].sum()
    return partes


def _recortar(texto, largo=22):
    return texto if len(texto) <= largo else texto[: largo - 1] + "…"


def _numero(v):
    return f"{v:,.1f}".rstrip("0").rstrip(".").replace(",", "X").replace(".", ",").replace("X", ".")


def _ejes_limpios(ax):
    for lado in ("top", "right", "left"):
        ax.spines[lado].set_visible(False)
    ax.spines["bottom"].set_color("#c3c2cc")
    ax.tick_params(colors=TINTA_SUAVE, labelsize=10, length=0)
    ax.set_axisbelow(True)


def _barras(ax, tabla, respondidas):
    datos = tabla.iloc[::-1]  # la primera opción arriba
    ax.barh(datos["texto"].map(_recortar), datos["cantidad"], color=VIOLETA, height=0.6)
    ax.xaxis.grid(True, color=GRILLA)
    _ejes_limpios(ax)
    tope = max(datos["cantidad"].max(), 1)
    ax.set_xlim(0, tope * 1.25)
    for y, cantidad in enumerate(datos["cantidad"]):
        porcentaje = 100 * cantidad / respondidas if respondidas else 0
        ax.text(cantidad + tope * 0.02, y, f"{_numero(porcentaje)} % ({cantidad})", va="center", fontsize=10, color=TINTA)
    ax.xaxis.get_major_locator().set_params(integer=True)


def _columnas(ax, tabla, _):
    ax.bar(tabla["texto"].map(lambda t: _recortar(t, 14)), tabla["cantidad"], color=VIOLETA, width=0.6)
    ax.yaxis.grid(True, color=GRILLA)
    _ejes_limpios(ax)
    tope = max(tabla["cantidad"].max(), 1)
    ax.set_ylim(0, tope * 1.18)
    for x, cantidad in enumerate(tabla["cantidad"]):
        if cantidad:
            ax.text(x, cantidad + tope * 0.03, str(cantidad), ha="center", fontsize=10, fontweight="bold", color=TINTA)
    ax.yaxis.get_major_locator().set_params(integer=True)
    if len(tabla) > 6:
        plt.setp(ax.get_xticklabels(), rotation=30, ha="right")


def _linea(ax, tabla, _):
    ax.plot(tabla["texto"], tabla["cantidad"], color=VIOLETA, linewidth=2, marker="o", markersize=7,
            markeredgecolor="white", markeredgewidth=2)
    ax.yaxis.grid(True, color=GRILLA)
    _ejes_limpios(ax)
    tope = max(tabla["cantidad"].max(), 1)
    ax.set_ylim(0, tope * 1.2)
    for x, cantidad in enumerate(tabla["cantidad"]):
        ax.text(x, cantidad + tope * 0.05, str(cantidad), ha="center", fontsize=10, fontweight="bold", color=TINTA)
    ax.yaxis.get_major_locator().set_params(integer=True)


def _leyenda(ax, partes):
    from matplotlib.patches import Patch

    ax.legend(
        handles=[Patch(color=c, label=f"{_recortar(t, 28)}  {_numero(p)} %") for t, c, p in
                 zip(partes["texto"], partes["color"], partes["parte"])],
        loc="center left", bbox_to_anchor=(1.02, 0.5), frameon=False, fontsize=10, labelcolor=TINTA,
    )


def _torta(ax, tabla, _):
    partes = _partes(tabla)
    ax.pie(
        partes["cantidad"], colors=partes["color"], startangle=90, counterclock=False,
        wedgeprops={"edgecolor": "white", "linewidth": 2},
        autopct=lambda p: f"{round(p)} %" if p >= 8 else "", pctdistance=0.62,
        textprops={"color": "white", "fontsize": 10, "fontweight": "bold"},
    )
    ax.set_aspect("equal")
    _leyenda(ax, partes)


def _distribucion(ax, tabla, _):
    partes = _partes(tabla)
    izquierda = 0
    for _, fila in partes.iterrows():
        ax.barh(0, fila["parte"], left=izquierda, color=fila["color"], height=0.6, edgecolor="white", linewidth=2)
        if fila["parte"] >= 12:
            color = "#0b0b0b" if fila["color"] == "#eda100" else "white"
            ax.text(izquierda + fila["parte"] / 2, 0, f"{round(fila['parte'])} %", ha="center", va="center",
                    fontsize=10, fontweight="bold", color=color)
        izquierda += fila["parte"]
    ax.set_xlim(0, 100)
    ax.axis("off")
    _leyenda(ax, partes)


DIBUJOS = {"barras": _barras, "columnas": _columnas, "linea": _linea, "torta": _torta, "distribucion": _distribucion}
TAMANOS = {"torta": (7, 3.4), "distribucion": (7, 1.6)}


def grafico_png(clave, tabla, respondidas):
    """Dibuja el gráfico pedido y lo devuelve como PNG."""
    alto = max(2.2, 0.45 * len(tabla) + 0.8) if clave == "barras" else 3.2
    figura, ax = plt.subplots(figsize=TAMANOS.get(clave, (7, alto)), dpi=110)
    try:
        DIBUJOS[clave](ax, tabla, respondidas)
        figura.tight_layout()
        salida = io.BytesIO()
        figura.savefig(salida, format="png", facecolor="white", bbox_inches="tight")
        return salida.getvalue()
    finally:
        plt.close(figura)
