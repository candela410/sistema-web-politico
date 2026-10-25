import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

# API de autenticación con las sesiones de Django (tablas usuarios y
# django_session). El frontend manda la cookie de sesión y el token CSRF.


def _usuario_json(usuario):
    return {
        "id": usuario.pk,
        "email": usuario.email,
        "username": usuario.username,
        "nombre": usuario.first_name,
        "apellido": usuario.last_name,
        "es_staff": usuario.is_staff,
        "grupos": list(usuario.groups.values_list("name", flat=True)),
        "campana": usuario.campana_id,
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
        return JsonResponse({"error": "JSON inválido."}, status=400)

    email = (datos.get("email") or "").strip()
    password = datos.get("password") or ""
    if not email or not password:
        return JsonResponse({"error": "Ingresá email y contraseña."}, status=400)

    usuario = authenticate(request, email=email, password=password)
    if usuario is None:
        return JsonResponse({"error": "Email o contraseña incorrectos."}, status=401)

    login(request, usuario)
    if not datos.get("recordar"):
        # Sin "Recordar", la sesión termina al cerrar el navegador
        request.session.set_expiry(0)
    return JsonResponse({"usuario": _usuario_json(usuario)})


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "No autenticado."}, status=401)
    return JsonResponse({"usuario": _usuario_json(request.user)})
