"""Contraseñas por correo.

El usuario elige su contraseña siempre desde un enlace que le llega por correo
(/restablecer/<uid>/<token> en el frontend):
- Al crear un usuario se le envía una invitación (no se escribe contraseña).
- Desde Gestión → Usuarios se le puede enviar un enlace para restablecerla.
- Desde el login, "¿Olvidó su contraseña?" lo pide la misma persona.
- Desde "Mi perfil", "Cambiar contraseña" se lo envía a su propio correo.

El token es el de Django (PasswordResetTokenGenerator): vence a las
PASSWORD_RESET_TIMEOUT segundos y deja de servir cuando cambia la contraseña o
el usuario vuelve a ingresar."""

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.http import require_http_methods, require_POST

from .api import error, leer_json, requiere_permiso
from .bitacora import registrar
from .models import Usuario
from .validaciones import email as validar_email

ENLACE_INVALIDO = "El enlace no es válido o ya venció. Solicite uno nuevo desde «¿Olvidó su contraseña?»."
SIN_ENVIO = "No se pudo enviar el correo. Revise la configuración de correo del servidor."
PEDIDO_RECIBIDO = (
    "Si el correo pertenece a un usuario activo, recibirá un enlace para elegir una contraseña nueva."
)


def _horas_de_validez():
    return settings.PASSWORD_RESET_TIMEOUT // 3600


def _enlace(usuario):
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    return f"{settings.FRONTEND_URL}/restablecer/{uid}/{token}"


def _cuerpo(usuario, enlace, invitacion):
    nombre = usuario.first_name or usuario.email
    if invitacion:
        motivo = (
            "Se creó su usuario en el Panel de gestión.\n"
            "Para elegir su contraseña e ingresar, abra este enlace:\n\n"
        )
    else:
        motivo = (
            "Recibimos un pedido para restablecer la contraseña de su cuenta del Panel de gestión.\n"
            "Para elegir una contraseña nueva, abra este enlace:\n\n"
        )
    pie = "" if invitacion else (
        "Si usted no realizó este pedido, puede ignorar este correo: su contraseña no cambia.\n"
    )
    return (
        f"Estimado/a {nombre}:\n\n"
        f"{motivo}{enlace}\n\n"
        f"El enlace vence en {_horas_de_validez()} horas y sirve una sola vez.\n"
        f"{pie}"
    )


def _cuerpo_redirigido(usuario, pedido_por, enlace, invitacion):
    nombre = pedido_por.first_name or pedido_por.email
    accion = "elegir la contraseña" if invitacion else "restablecer la contraseña"
    return (
        f"Estimado/a {nombre}:\n\n"
        f"Usted solicitó {accion} de {usuario.email}. Ese correo es de prueba, por eso\n"
        "el enlace le llega a usted. Con él se elige la contraseña de ese usuario:\n\n"
        f"{enlace}\n\n"
        f"El enlace vence en {_horas_de_validez()} horas y sirve una sola vez.\n"
    )


def _es_real(email):
    """Sin CORREOS_REALES en el .env (correos en la terminal) todos cuentan como reales."""
    return not settings.CORREOS_REALES or email.lower() in settings.CORREOS_REALES


def enviar_enlace_a(usuario, pedido_por=None, invitacion=False):
    """Envía el enlace para elegir la contraseña. Si el correo del usuario es de
    prueba (no está en CORREOS_REALES) le llega a quien lo pidió.
    Devuelve (correo de destino, None) o (None, mensaje de error)."""
    enlace = _enlace(usuario)
    asunto = "Bienvenido/a al Panel de gestión" if invitacion else "Restablecer su contraseña"
    if _es_real(usuario.email):
        destino, cuerpo = usuario.email, _cuerpo(usuario, enlace, invitacion)
    elif pedido_por is not None and _es_real(pedido_por.email):
        destino = pedido_por.email
        asunto = f"{asunto} ({usuario.email})"
        cuerpo = _cuerpo_redirigido(usuario, pedido_por, enlace, invitacion)
    else:
        return None, f"{usuario.email} es un correo de prueba: no hay a dónde enviar el enlace."
    try:
        send_mail(asunto, cuerpo, None, [destino])
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


@require_POST
def olvide(request):
    """"¿Olvidó su contraseña?" del login: POST {email}. Siempre responde lo
    mismo, exista o no el usuario, para no revelar qué correos están cargados."""
    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    email = str(datos.get("email") or "").strip().lower()
    mensaje = validar_email(email)
    if mensaje:
        return error(mensaje)
    usuario = Usuario.objects.filter(email__iexact=email, is_active=True).first()
    if usuario is not None and _es_real(usuario.email):
        _, mensaje = enviar_enlace_a(usuario)
        if mensaje == SIN_ENVIO:
            return error(SIN_ENVIO, 502)
    return JsonResponse({"ok": True, "mensaje": PEDIDO_RECIBIDO})


def _usuario_del_enlace(uid, token):
    try:
        usuario = Usuario.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (Usuario.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    return usuario if default_token_generator.check_token(usuario, token) else None


@require_http_methods(["GET", "POST"])
def restablecer(request, uid, token):
    """GET: comprueba el enlace (lo usa la pantalla al abrirse).
    POST {password}: guarda la contraseña nueva. No hace falta haber iniciado sesión."""
    usuario = _usuario_del_enlace(uid, token)
    if usuario is None:
        return error(ENLACE_INVALIDO, 400)
    if request.method == "GET":
        return JsonResponse({"email": usuario.email, "nueva": not usuario.has_usable_password()})

    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    password = datos.get("password") or ""
    if not isinstance(password, str) or not password:
        return error("Ingrese la contraseña nueva.")
    try:
        validate_password(password, usuario)
    except ValidationError as e:
        return error(" ".join(e.messages))
    usuario.set_password(password)
    usuario.save(update_fields=["password"])
    return JsonResponse({"ok": True})
