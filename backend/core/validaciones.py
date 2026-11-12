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
- Correo y contraseña: las mismas expresiones regulares que usa el frontend
  (frontend/src/validaciones.js), para que front y back acepten lo mismo.
"""

import re

PERSONA = re.compile(r"^[^\W\d_]+(?:[ '\-][^\W\d_]+)*$")
COSA = re.compile(r"^[^\W_](?:[^\W_]|[ .,\-'()/º°])*$")
SIMBOLOS = re.compile(r"[@#$^*_=<>{}\[\]|\\~`]")
TELEFONO = re.compile(r"^\+?[\d\s()\-]+$")
# Iguales a las del frontend (validaciones.js)
EMAIL = re.compile(r"[^\s@]+@[^\s@.]+(\.[^\s@.]+)+")
CONTRASENA = re.compile(r"(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{6,}")

MENSAJE_EMAIL = "Ingrese un correo electrónico válido (por ejemplo, usuario@correo.com)."
MENSAJE_CONTRASENA = "La contraseña debe tener al menos 6 caracteres, con una mayúscula, una minúscula y un número."


def espacios(texto):
    """Saca los espacios de los costados y deja uno solo entre palabras."""
    return re.sub(r"\s+", " ", texto or "").strip()


def nombre_persona(texto, campo="El nombre"):
    if not texto:
        return None
    if len(texto) < 2:
        return f"{campo} es muy corto."
    if not PERSONA.match(texto):
        return f"{campo} solo admite letras y espacios."
    return None


def nombre_cosa(texto, campo="El nombre"):
    if not texto:
        return None
    if len(texto) < 2:
        return f"{campo} es muy corto."
    if not COSA.match(texto):
        return f"{campo} solo admite letras, números, espacios y . , - ( ) /"
    return None


def texto_libre(texto, campo="El texto"):
    if not texto:
        return None
    if SIMBOLOS.search(texto):
        return f"{campo} no admite símbolos como @ # $ * _ = < > {{ }} [ ] | ~"
    if not re.search(r"[^\W_]", texto):
        return f"{campo} debe contener letras o números."
    return None


def documento(texto):
    if not texto:
        return None
    if not texto.isdigit() or not 7 <= len(texto) <= 8:
        return "El documento debe tener 7 u 8 números, sin puntos."
    return None


def telefono(texto):
    if not texto:
        return None
    cifras = re.sub(r"\D", "", texto)
    if not TELEFONO.match(texto) or not 8 <= len(cifras) <= 15:
        return "El teléfono debe tener entre 8 y 15 números."
    return None


def email(texto):
    """Formato de correo (obligatorio)."""
    if not EMAIL.fullmatch((texto or "").strip()):
        return MENSAJE_EMAIL
    return None


def contrasena(texto):
    """6 o más caracteres con una mayúscula, una minúscula y un número."""
    if not isinstance(texto, str) or not CONTRASENA.fullmatch(texto):
        return MENSAJE_CONTRASENA
    return None


class ReglaContrasena:
    """Validador de contraseñas de Django (AUTH_PASSWORD_VALIDATORS) con la
    misma regla que el frontend."""

    def validate(self, password, user=None):
        from django.core.exceptions import ValidationError

        mensaje = contrasena(password)
        if mensaje:
            raise ValidationError(mensaje, code="contrasena_debil")

    def get_help_text(self):
        return MENSAJE_CONTRASENA
