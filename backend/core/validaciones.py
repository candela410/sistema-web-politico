"""Reglas para los textos que se escriben en los formularios. Cada función
devuelve None si el texto es válido o el mensaje de error para mostrar.

- Nombres de personas (usuarios y encuestados): solo letras, espacios, guion y
  apóstrofo ("María José", "O'Connor", "Pérez-Gil").
- Nombres de cosas (campaña, zona, ruta, equipo, categoría, rol): letras,
  números, espacios y . , - ' ( ) / º °  ("Ruta 1", "Zona Norte (B° Castañares)").
- Textos libres (título y preguntas de un cuestionario, opciones): cualquier
  signo de escritura, pero no símbolos como @ # $ * _ = < > { } [ ] | \\ ~ `
- Documento: solo números, de 7 u 8 cifras (DNI).
- Teléfono: números, con espacios, guiones, paréntesis o + adelante; de 8 a 15 cifras.
"""

import re

PERSONA = re.compile(r"^[^\W\d_]+(?:[ '\-][^\W\d_]+)*$")
COSA = re.compile(r"^[^\W_](?:[^\W_]|[ .,\-'()/º°])*$")
SIMBOLOS = re.compile(r"[@#$^*_=<>{}\[\]|\\~`]")
TELEFONO = re.compile(r"^\+?[\d\s()\-]+$")


def espacios(texto):
    """Saca los espacios de los costados y deja uno solo entre palabras."""
    return re.sub(r"\s+", " ", texto or "").strip()


def nombre_persona(texto, campo="El nombre"):
    if not texto:
        return None
    if len(texto) < 2:
        return f"{campo} es muy corto."
    if not PERSONA.match(texto):
        return f"{campo} solo puede tener letras y espacios (sin números ni símbolos como @)."
    return None


def nombre_cosa(texto, campo="El nombre"):
    if not texto:
        return None
    if len(texto) < 2:
        return f"{campo} es muy corto."
    if not COSA.match(texto):
        return f"{campo} solo puede tener letras, números, espacios y . , - ( ) / (sin símbolos como @)."
    return None


def texto_libre(texto, campo="El texto"):
    if not texto:
        return None
    if SIMBOLOS.search(texto):
        return f"{campo} no puede tener símbolos como @ # $ * _ = < > {{ }} [ ] | ~"
    if not re.search(r"[^\W_]", texto):
        return f"{campo} tiene que tener letras o números."
    return None


def documento(texto):
    if not texto:
        return None
    if not texto.isdigit() or not 7 <= len(texto) <= 8:
        return "El documento tiene que ser un DNI: solo números, de 7 u 8 cifras."
    return None


def telefono(texto):
    if not texto:
        return None
    cifras = re.sub(r"\D", "", texto)
    if not TELEFONO.match(texto) or not 8 <= len(cifras) <= 15:
        return "El teléfono tiene que tener entre 8 y 15 números (puede llevar espacios, guiones o + adelante)."
    return None
