import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .api import campana_activa, puede_elegir_campana
from .bitacora import registrar

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
        "es_militante": hasattr(usuario, "militante"),
        "grupos": list(usuario.groups.values_list("name", flat=True)),
        # Permisos de Django ("core.add_cuestionario", …): el frontend arma el menú con esto
        "permisos": sorted(usuario.get_all_permissions()),
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
        return JsonResponse({"error": "No autenticado."}, status=401)
    return JsonResponse({"usuario": usuario_json(request)})
