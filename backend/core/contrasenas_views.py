"""Contraseñas por correo.

El usuario elige su contraseña siempre desde un enlace que le llega por correo
(/restablecer/<uid>/<token> en el frontend):
- Al crear un usuario se le envía una invitación (no se escribe contraseña).
- Desde Gestión → Usuarios se le puede enviar un enlace para restablecerla.
- Desde el login, "¿Olvidó su contraseña?" lo pide la misma persona con su
  nombre de usuario: el enlace llega al correo asociado a ese usuario.
- Desde "Mi perfil", "Cambiar contraseña" se lo envía a su propio correo.

También el cambio de correo de "Mi perfil": se pide la contraseña y el correo
nuevo recién se guarda cuando la persona abre el enlace que le llega a ese
correo (/confirmar-correo/<token> en el frontend). Así se comprueba que el
correo existe y es suyo. Al correo anterior le llega un aviso.

El token es el de Django (PasswordResetTokenGenerator): vence a las
PASSWORD_RESET_TIMEOUT segundos y deja de servir cuando cambia la contraseña o
el usuario vuelve a ingresar."""

from types import SimpleNamespace

from django.conf import settings
from django.core import signing
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage, EmailMultiAlternatives
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.http import require_http_methods, require_POST

from .api import error, leer_json, requiere_permiso
from .bitacora import registrar
from .limites import ip_de, sumar, superado
from .notificaciones import contrasena_cambiada
from .models import Usuario

ENLACE_INVALIDO = "El enlace no es válido o ya venció. Solicite uno nuevo desde «¿Olvidó su contraseña?»."
SIN_ENVIO = "No se pudo enviar el correo. Revise la configuración de correo del servidor."
PEDIDO_RECIBIDO = (
    "Si el nombre de usuario pertenece a un usuario activo, enviamos a su correo electrónico un enlace "
    "para elegir una contraseña nueva. Revise su bandeja de entrada y la carpeta de spam."
)


def _horas_de_validez():
    return settings.PASSWORD_RESET_TIMEOUT // 3600


def _enlace(usuario):
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    return f"{settings.FRONTEND_URL}/restablecer/{uid}/{token}"


def _contenido(usuario, enlace, invitacion, pedido_por=None):
    """Textos del correo (los mismos para la versión con diseño y la de texto).
    pedido_por: el correo del usuario es de prueba y el enlace le llega a quien
    lo pidió."""
    if pedido_por is not None:
        accion = "elegir la contraseña" if invitacion else "restablecer la contraseña"
        return {
            "etiqueta": "Enlace solicitado",
            "titulo": "Enlace para otro usuario",
            "saludo": f"Estimado/a {pedido_por.first_name or pedido_por.email}:",
            "parrafos": [
                f"Usted solicitó {accion} del usuario {usuario.username} ({usuario.email}).",
                "Como ese correo electrónico es de prueba, le enviamos el enlace a usted. "
                "Con él podrá elegir la contraseña de ese usuario.",
            ],
            "boton": "Elegir la contraseña",
            "aviso": "",
        }
    saludo = f"Estimado/a {usuario.first_name or usuario.email}:"
    if invitacion:
        return {
            "etiqueta": "Bienvenida",
            "titulo": "Su usuario fue creado",
            "saludo": saludo,
            "parrafos": [
                "Le damos la bienvenida al Panel de gestión. La administración creó un usuario a su nombre. "
                f"Su nombre de usuario es: {usuario.username}",
                "Para comenzar, elija su contraseña desde el siguiente botón. Luego podrá ingresar al "
                "sistema con su nombre de usuario y la contraseña elegida.",
            ],
            "boton": "Elegir mi contraseña",
            "aviso": "",
        }
    return {
        "etiqueta": "Seguridad de la cuenta",
        "titulo": "Restablecimiento de contraseña",
        "saludo": saludo,
        "parrafos": [
            "Recibimos una solicitud para restablecer la contraseña de su cuenta en el Panel de gestión "
            f"(nombre de usuario: {usuario.username}).",
            "Para elegir una contraseña nueva, presione el siguiente botón.",
        ],
        "boton": "Restablecer contraseña",
        "aviso": " Si usted no realizó esta solicitud, puede ignorar este mensaje: su contraseña actual no cambiará.",
    }


def _correo(asunto, contenido, enlace, destino):
    """Arma el correo con dos versiones: con diseño (HTML) y en texto plano, para
    los programas de correo que no muestran HTML."""
    contexto = {**contenido, "asunto": asunto, "enlace": enlace, "horas": _horas_de_validez(),
                "resumen": contenido["parrafos"][0]}
    texto = (
        f"{contenido['saludo']}\n\n"
        + "\n\n".join(contenido["parrafos"])
        + f"\n\n{contenido['boton']}:\n{enlace}\n\n"
        + f"El enlace vence en {contexto['horas']} horas y puede utilizarse una sola vez."
        + (contenido["aviso"] or "")
        + "\n\nAtentamente,\nAdministración del Panel de gestión\n\n"
        + "Este es un mensaje automático. Por favor, no responda a este correo.\n"
    )
    mensaje = EmailMultiAlternatives(asunto, texto, None, [destino])
    mensaje.attach_alternative(render_to_string("correos/enlace.html", contexto), "text/html")
    return mensaje


def _es_real(email):
    """Sin CORREOS_REALES en el .env (correos en la terminal) todos cuentan como reales."""
    return not settings.CORREOS_REALES or email.lower() in settings.CORREOS_REALES


def enviar_enlace_a(usuario, pedido_por=None, invitacion=False):
    """Envía el enlace para elegir la contraseña. Si el correo del usuario es de
    prueba (no está en CORREOS_REALES) le llega a quien lo pidió.
    Devuelve (correo de destino, None) o (None, mensaje de error)."""
    enlace = _enlace(usuario)
    asunto = "Bienvenido/a al Panel de gestión" if invitacion else "Restablecimiento de contraseña"
    if _es_real(usuario.email):
        destino, contenido = usuario.email, _contenido(usuario, enlace, invitacion)
    elif pedido_por is not None and _es_real(pedido_por.email):
        destino = pedido_por.email
        asunto = f"{asunto} ({usuario.email})"
        contenido = _contenido(usuario, enlace, invitacion, pedido_por)
    else:
        return None, f"{usuario.email} es un correo de prueba: no hay a dónde enviar el enlace."
    try:
        _correo(asunto, contenido, enlace, destino).send()
    except OSError:
        # smtplib.SMTPException es un OSError: clave equivocada, sin conexión, etc.
        return None, SIN_ENVIO
    return destino, None


@require_POST
@requiere_permiso("core.change_usuario")
def enviar_enlace(request, pk):
    """Botón "Restablecer contraseña" de Gestión → Usuarios."""
    usuario = get_object_or_404(Usuario, pk=pk, campana=request.campana)
    if usuario.is_superuser and not request.user.is_superuser:
        return error("Solo un superusuario puede modificar a otro superusuario.", 403)
    if not usuario.is_active:
        return error("El usuario está desactivado. Actívelo antes de restablecer su contraseña.", 409)
    destino, mensaje = enviar_enlace_a(usuario, request.user)
    if mensaje:
        return error(mensaje, 502 if mensaje == SIN_ENVIO else 409)
    registrar(request, usuario, "editar", detalle=f"Envió a {destino} un enlace para restablecer la contraseña")
    return JsonResponse({"ok": True, "email": destino, "redirigido": destino != usuario.email})


@require_POST
def cambiar_propia(request):
    """"Cambiar contraseña" de Mi perfil: envía el enlace al correo del usuario
    que inició sesión (siempre a su propio correo, nunca a otro)."""
    if not request.user.is_authenticated:
        return error("Debe iniciar sesión.", 401)
    usuario = request.user
    if not _es_real(usuario.email):
        return error(f"{usuario.email} es un correo de prueba: no puede recibir el enlace.", 409)
    destino, mensaje = enviar_enlace_a(usuario)
    if mensaje:
        return error(mensaje, 502 if mensaje == SIN_ENVIO else 409)
    return JsonResponse({"ok": True, "email": destino})


OLVIDE_MAX_POR_IP = 10       # pedidos desde la misma IP...
OLVIDE_MAX_POR_USUARIO = 3   # ...o para el mismo usuario...
OLVIDE_VENTANA = 60 * 60     # ...en una hora


@require_POST
def olvide(request):
    """"¿Olvidó su contraseña?" del login: POST {usuario}. El enlace se envía
    al correo asociado a ese nombre de usuario. Siempre responde lo mismo,
    exista o no el usuario, para no revelar qué usuarios están cargados."""
    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    nombre = str(datos.get("usuario") or "").strip()
    if not nombre:
        return error("Ingrese su nombre de usuario.")
    # Límite de pedidos: por IP se avisa; por usuario se responde igual que
    # siempre pero sin mandar otro correo (no revela si el usuario existe y
    # evita llenarle la casilla a alguien)
    ip = ip_de(request)
    if superado("olvide-ip", ip, OLVIDE_MAX_POR_IP):
        return error("Demasiados pedidos. Espere un rato e intente de nuevo.", 429)
    sumar("olvide-ip", ip, OLVIDE_VENTANA)
    if superado("olvide-usuario", nombre, OLVIDE_MAX_POR_USUARIO):
        return JsonResponse({"ok": True, "mensaje": PEDIDO_RECIBIDO})
    sumar("olvide-usuario", nombre, OLVIDE_VENTANA)
    usuario = buscar_por_nombre(nombre)
    if usuario is not None and _es_real(usuario.email):
        _, mensaje = enviar_enlace_a(usuario)
        if mensaje == SIN_ENVIO:
            return error(SIN_ENVIO, 502)
    return JsonResponse({"ok": True, "mensaje": PEDIDO_RECIBIDO})


def buscar_por_nombre(nombre):
    """Usuario activo con ese nombre de usuario (sin distinguir mayúsculas).
    Solo por nombre de usuario (apellido + inicial del nombre): con el correo
    no se encuentra a nadie."""
    if "@" in nombre:
        return None
    return Usuario.objects.filter(username__iexact=nombre, is_active=True).first()


def _usuario_del_enlace(uid, token):
    try:
        usuario = Usuario.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (Usuario.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    return usuario if default_token_generator.check_token(usuario, token) else None


@require_http_methods(["GET", "POST"])
def restablecer(request, uid, token):
    """GET: comprueba el enlace (lo usa la pantalla al abrirse).
    POST {password, repetida}: guarda la contraseña nueva. No hace falta haber iniciado sesión."""
    usuario = _usuario_del_enlace(uid, token)
    if usuario is None:
        return error(ENLACE_INVALIDO, 400)
    if request.method == "GET":
        return JsonResponse({
            "username": usuario.username,
            "email": usuario.email,
            "nueva": not usuario.has_usable_password(),
        })

    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    password = datos.get("password") or ""
    if not isinstance(password, str) or not password:
        return error("Ingrese la contraseña nueva.")
    # La pantalla la pide dos veces
    if "repetida" in datos and datos["repetida"] != password:
        return error("Las contraseñas no coinciden.")
    try:
        validate_password(password, usuario)
    except ValidationError as e:
        return error(" ".join(e.messages))
    tenia = usuario.has_usable_password()
    usuario.set_password(password)
    usuario.save(update_fields=["password"])
    # Al elegirla por primera vez (invitación) no se avisa: no es un cambio
    if tenia:
        contrasena_cambiada(usuario)
    return JsonResponse({"ok": True})


# ---------------------------------------------------------------------------
# Cambio de correo (Mi perfil)
# ---------------------------------------------------------------------------

SAL_CORREO = "cambio-de-correo"
CORREO_INVALIDO = (
    "El enlace no es válido, ya se usó o venció. Vuelva a cambiar el correo desde "
    "Configuración → Mi perfil para recibir uno nuevo."
)


def enviar_verificacion_correo(usuario, nuevo):
    """Envía al correo nuevo el enlace para confirmarlo, y un aviso al anterior.
    El enlace lleva firmados el usuario, el correo actual y el nuevo: deja de
    servir si el correo ya cambió (se usa una sola vez) y vence a las
    PASSWORD_RESET_TIMEOUT segundos. Devuelve None o el mensaje de error."""
    if not _es_real(nuevo):
        return f"{nuevo} es un correo de prueba: no puede recibir el enlace de verificación."
    token = signing.dumps({"u": usuario.pk, "de": usuario.email.lower(), "a": nuevo}, salt=SAL_CORREO, compress=True)
    enlace = f"{settings.FRONTEND_URL}/confirmar-correo/{token}"
    contenido = {
        "etiqueta": "Verificación de correo",
        "titulo": "Confirme su nuevo correo",
        "saludo": f"Estimado/a {usuario.first_name or usuario.username}:",
        "parrafos": [
            f"Usted pidió usar este correo ({nuevo}) en su cuenta del Panel de gestión "
            f"(nombre de usuario: {usuario.username}).",
            "Para confirmarlo, presione el siguiente botón. Hasta que lo haga, su cuenta sigue usando el correo anterior.",
        ],
        "boton": "Confirmar mi correo",
        "aviso": " Si usted no pidió este cambio, ignore este mensaje: no se modificará nada.",
    }
    try:
        _correo("Confirme su nuevo correo electrónico", contenido, enlace, nuevo).send()
    except OSError:
        return SIN_ENVIO

    # Aviso al correo anterior, por si el cambio no lo pidió la persona. Si
    # falla, el cambio sigue igual: el enlace ya se envió.
    if _es_real(usuario.email):
        aviso = EmailMessage(
            "Se pidió cambiar el correo de su cuenta",
            f"Estimado/a {usuario.first_name or usuario.username}:\n\n"
            f"Se pidió cambiar el correo de su cuenta del Panel de gestión (usuario {usuario.username}) "
            f"a {nuevo}. El cambio se hará cuando se confirme desde ese correo.\n\n"
            "Si no fue usted, ingrese al sistema y cambie su contraseña, o avise a un administrador.\n\n"
            "Atentamente,\nAdministración del Panel de gestión\n\n"
            "Este es un mensaje automático. Por favor, no responda a este correo.\n",
            None,
            [usuario.email],
        )
        try:
            aviso.send()
        except OSError:
            pass
    return None


@require_POST
def confirmar_correo(request):
    """POST {token}: aplica el cambio de correo del enlace. No hace falta haber
    iniciado sesión (el enlace prueba que la persona tiene acceso a ese correo)."""
    datos = leer_json(request)
    token = str((datos or {}).get("token") or "")
    try:
        cambio = signing.loads(token, salt=SAL_CORREO, max_age=settings.PASSWORD_RESET_TIMEOUT)
    except signing.BadSignature:  # también si venció (SignatureExpired)
        return error(CORREO_INVALIDO, 400)
    usuario = Usuario.objects.filter(pk=cambio.get("u"), is_active=True).first()
    # Si el correo ya no es el de cuando se pidió, el enlace ya se usó
    if usuario is None or usuario.email.lower() != cambio.get("de"):
        return error(CORREO_INVALIDO, 400)
    nuevo = cambio["a"]
    if Usuario.objects.filter(email__iexact=nuevo).exclude(pk=usuario.pk).exists():
        return error("Ese correo ya lo usa otro usuario. El correo no se cambió.", 409)
    anterior = usuario.email
    usuario.email = nuevo
    usuario.save(update_fields=["email"])
    registrar(
        SimpleNamespace(user=usuario, campana=usuario.campana),
        usuario,
        "editar",
        cambios=[{"campo": "Email", "antes": anterior, "despues": nuevo}],
        detalle="Confirmó su nuevo correo desde el enlace de verificación",
    )
    return JsonResponse({"ok": True, "email": nuevo, "username": usuario.username})
