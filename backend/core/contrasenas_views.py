"""Restablecer la contraseña por correo.

Desde Gestión → Usuarios se envía al email del usuario un enlace al frontend
(/restablecer/<uid>/<token>). El token es el de Django (PasswordResetTokenGenerator):
vence a las PASSWORD_RESET_TIMEOUT segundos y deja de servir cuando cambia la
contraseña o el usuario vuelve a ingresar."""

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

ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pedí uno nuevo a la administración."


def _horas_de_validez():
    return settings.PASSWORD_RESET_TIMEOUT // 3600


def _mensaje(usuario, enlace):
    nombre = usuario.first_name or usuario.email
    return (
        f"Hola, {nombre}:\n\n"
        "Recibimos un pedido para restablecer la contraseña de tu cuenta del Panel de gestión.\n"
        "Para elegir una contraseña nueva, entrá a este enlace:\n\n"
        f"{enlace}\n\n"
        f"El enlace vence en {_horas_de_validez()} horas y sirve una sola vez.\n"
        "Si no pediste este cambio, podés ignorar este correo: tu contraseña sigue siendo la misma.\n"
    )


@require_POST
@requiere_permiso("core.change_usuario")
def enviar_enlace(request, pk):
    """Envía el enlace para restablecer la contraseña al email del usuario."""
    usuario = get_object_or_404(Usuario, pk=pk, campana=request.campana)
    if usuario.is_superuser and not request.user.is_superuser:
        return error("Solo un superusuario puede modificar a otro superusuario.", 403)
    if not usuario.is_active:
        return error("El usuario está desactivado: activalo antes de restablecer su contraseña.", 409)

    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    token = default_token_generator.make_token(usuario)
    enlace = f"{settings.FRONTEND_URL}/restablecer/{uid}/{token}"
    send_mail("Restablecer tu contraseña", _mensaje(usuario, enlace), None, [usuario.email])
    registrar(request, usuario, "editar", detalle=f"Envió a {usuario.email} un enlace para restablecer la contraseña")
    return JsonResponse({"ok": True, "email": usuario.email})


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
        return JsonResponse({"email": usuario.email})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    password = datos.get("password") or ""
    if not isinstance(password, str) or not password:
        return error("Ingresá la contraseña nueva.")
    try:
        validate_password(password, usuario)
    except ValidationError as e:
        return error(" ".join(e.messages))
    usuario.set_password(password)
    usuario.save(update_fields=["password"])
    return JsonResponse({"ok": True})
