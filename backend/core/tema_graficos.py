"""Gráficos en modo oscuro.

Los gráficos se dibujan siempre con los colores claros (los mismos del PDF y
del script de analítica). Cuando la pantalla está en modo oscuro, el frontend
pide la imagen con ?tema=oscuro y, justo antes de guardarla, `oscurecer`
recorre la figura y cambia cada color claro por su par oscuro: fondo, textos,
grilla, ejes y bordes. Los colores de las series (barras, porciones) se
mantienen, salvo el violeta, que se aclara para que se lea sobre fondo oscuro.
"""

from matplotlib.collections import Collection
from matplotlib.colors import LinearSegmentedColormap, to_hex, to_rgba
from matplotlib.image import AxesImage
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from matplotlib.text import Text

# Mismos tonos que src/tema-oscuro.css (fondo de las tarjetas, textos, líneas)
FONDO = "#161921"
TEXTO = "#e4e6ec"
TEXTO_SUAVE = "#9ba2b0"
GRILLA = "#262b36"
EJE = "#3a4150"
VIOLETA = "#8b76f0"

# Color claro → color oscuro. Las claves van en minúscula y sin transparencia.
_TEXTOS = {
    "#15121c": TEXTO,   # TINTA
    "#000000": TEXTO,   # negro por defecto de matplotlib
    "#5d5a66": TEXTO_SUAVE,  # TINTA_SUAVE
    "#51318f": VIOLETA,
}
_TRAZOS = {
    "#ffffff": FONDO,   # bordes blancos entre porciones / barras
    "#ecebf0": GRILLA,  # grilla
    "#c3c2cc": EJE,     # eje inferior
    "#15121c": TEXTO,
    "#000000": EJE,
    "#5d5a66": TEXTO_SUAVE,
    "#51318f": VIOLETA,
}
_RELLENOS = {
    "#ffffff": FONDO,
    "#51318f": VIOLETA,
}

# Mapa de calor: de casi fondo a violeta claro (en vez de blanco → violeta)
_CALOR = LinearSegmentedColormap.from_list("violetas_oscuro", ["#1f2330", "#352d66", "#5a45bf", "#8b76f0"])

PARAMETRO = "tema"


def pide_oscuro(request):
    return request.GET.get(PARAMETRO) == "oscuro"


def _cambiar(color, tabla):
    """Devuelve el color equivalente de `tabla` conservando la transparencia,
    o None si no hay que cambiarlo."""
    if color is None or (isinstance(color, str) and color.lower() == "none"):
        return None
    try:
        r, g, b, a = to_rgba(color)
    except ValueError:
        return None
    if a == 0:
        return None
    nuevo = tabla.get(to_hex((r, g, b)))
    if nuevo is None:
        return None
    nr, ng, nb, _ = to_rgba(nuevo)
    return (nr, ng, nb, a)


def _cambiar_lista(colores, tabla):
    cambiados, alguno = [], False
    for c in colores:
        n = _cambiar(c, tabla)
        cambiados.append(n if n is not None else tuple(c))
        alguno = alguno or n is not None
    return cambiados if alguno else None


def oscurecer(fig):
    """Pasa la figura a colores de modo oscuro (la modifica y la devuelve)."""
    fig.patch.set_facecolor(FONDO)
    for ax in fig.axes:
        ax.patch.set_facecolor(FONDO)

    for obj in fig.findobj():
        if isinstance(obj, Text):
            n = _cambiar(obj.get_color(), _TEXTOS)
            if n is not None:
                obj.set_color(n)
        elif isinstance(obj, Line2D):
            for get, set_ in (
                (obj.get_color, obj.set_color),
                (obj.get_markeredgecolor, obj.set_markeredgecolor),
                (obj.get_markerfacecolor, obj.set_markerfacecolor),
            ):
                n = _cambiar(get(), _TRAZOS)
                if n is not None:
                    set_(n)
        elif isinstance(obj, Patch):
            if obj is fig.patch or any(obj is ax.patch for ax in fig.axes):
                continue
            n = _cambiar(obj.get_facecolor(), _RELLENOS)
            if n is not None:
                obj.set_facecolor(n)
            n = _cambiar(obj.get_edgecolor(), _TRAZOS)
            if n is not None:
                obj.set_edgecolor(n)
        elif isinstance(obj, AxesImage):
            if obj.get_cmap().name in ("Purples", "Purples_r"):
                obj.set_cmap(_CALOR)
        elif isinstance(obj, Collection):
            n = _cambiar_lista(obj.get_facecolors(), _RELLENOS)
            if n is not None:
                obj.set_facecolors(n)
            n = _cambiar_lista(obj.get_edgecolors(), _TRAZOS)
            if n is not None:
                obj.set_edgecolors(n)

    # Leyendas: sin marco claro
    for ax in fig.axes:
        leyenda = ax.get_legend()
        if leyenda is not None:
            leyenda.get_frame().set_facecolor(FONDO)
            leyenda.get_frame().set_edgecolor(GRILLA)
    return fig
