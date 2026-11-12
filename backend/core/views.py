import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .api import campana_activa, permisos_de, puede_elegir_campana
from .bitacora import registrar
from .validaciones import contrasena as validar_contrasena
from .validaciones import email as validar_email

# API de autenticación con las sesiones de Django (tablas usuarios y
# django_session). El frontend manda la cookie de sesión y el token CSRF.


def usuario_json(request):
    usuario = request.user
    campana = campana_activa(request)
    return {
        "id": usuario.pk,
        "email": usuario.email,
        "username": usuario.username,
        "nombre": usuario.first_name,
        "apellido": usuario.last_name,
        "es_superusuario": usuario.is_superuser,
        "grupos": list(usuario.groups.values_list("name", flat=True)),
        # Permisos de Django ("core.add_cuestionario", …): el frontend arma el menú con esto
        "permisos": sorted(permisos_de(usuario)),
        "puede_elegir_campana": puede_elegir_campana(usuario),
        "campana": {"id": campana.pk, "nombre": campana.nombre} if campana else None,
    }


@require_GET
@ensure_csrf_cookie
def csrf(request):
    # Deja la cookie csrftoken para que el frontend pueda hacer POST
    return JsonResponse({"ok": True})


@require_POST
def login_view(request):
    try:
        datos = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Los datos enviados no son válidos."}, status=400)

    email = str(datos.get("email") or "").strip()
    password = datos.get("password") or ""
    if not email or not password:
        return JsonResponse({"error": "Ingrese su correo electrónico y su contraseña."}, status=400)
    # Mismas reglas que el formulario del frontend (validaciones.js)
    mensaje = validar_email(email) or validar_contrasena(password)
    if mensaje:
        return JsonResponse({"error": mensaje}, status=400)

    usuario = authenticate(request, email=email, password=password)
    if usuario is None:
        return JsonResponse({"error": "El correo electrónico o la contraseña son incorrectos."}, status=401)

    login(request, usuario)
    if not datos.get("recordar"):
        # Sin "Recordar", la sesión termina al cerrar el navegador
        request.session.set_expiry(0)
    registrar(request, usuario, "sesion", detalle="Inició sesión", campana=usuario.campana)
    return JsonResponse({"usuario": usuario_json(request)})


@require_POST
def logout_view(request):
    if request.user.is_authenticated:
        registrar(request, request.user, "sesion", detalle="Cerró sesión", campana=campana_activa(request))
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Debe iniciar sesión."}, status=401)
    return JsonResponse({"usuario": usuario_json(request)})
