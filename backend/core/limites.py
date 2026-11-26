"""Límite de intentos (rate limiting) para el login y "¿Olvidó su contraseña?".

Cuenta los intentos en la caché de Django durante una ventana de tiempo. Si se
pasa del máximo, la acción queda bloqueada hasta que termine la ventana. Así se
frena a quien prueba muchas contraseñas o pide muchos correos de recuperación.
"""

from django.core.cache import cache


def ip_de(request):
    """IP de quien hace el pedido (detrás de un proxy viene en X-Forwarded-For)."""
    reenviada = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return reenviada.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "") or "desconocida"


def _clave(tipo, valor):
    return f"limite:{tipo}:{str(valor).strip().lower()}"


def superado(tipo, valor, maximo):
    """True si ya hubo `maximo` intentos o más dentro de la ventana."""
    return (cache.get(_clave(tipo, valor)) or 0) >= maximo


def sumar(tipo, valor, ventana):
    """Suma un intento. La ventana (en segundos) arranca con el primero."""
    clave = _clave(tipo, valor)
    if cache.add(clave, 1, ventana):
        return 1
    try:
        return cache.incr(clave)
    except ValueError:  # venció justo entre el add y el incr
        cache.add(clave, 1, ventana)
        return 1


def limpiar(tipo, valor):
    cache.delete(_clave(tipo, valor))
