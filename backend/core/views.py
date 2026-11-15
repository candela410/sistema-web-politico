import base64
import binascii
import io
import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .api import campana_activa, error, leer_json, permisos_de, puede_elegir_campana, requiere_sesion
from .bitacora import diferencias, registrar
from .contrasenas_views import buscar_por_nombre
from .models import Usuario, username_libre
from .validaciones import contrasena as validar_contrasena
from .validaciones import email as validar_email
from .validaciones import espacios, nombre_persona
from .validaciones import telefono as validar_telefono

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
        # Datos de "Mi perfil"
        "documento": usuario.documento or "",
        "telefono": usuario.telefono or "",
        "direccion": usuario.direccion or "",
        "foto": usuario.foto or "",
        "equipo": usuario.equipo.nombre if usuario.equipo_id else None,
        "ultimo_ingreso": usuario.last_login.isoformat() if usuario.last_login else None,
        "alta": usuario.date_joined.isoformat(),
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

    nombre = str(datos.get("usuario") or "").strip()
    password = datos.get("password") or ""
    if not nombre or not password:
        return JsonResponse({"error": "Ingrese su nombre de usuario y su contraseña."}, status=400)
    # Misma regla que el formulario del frontend (validaciones.js)
    mensaje = validar_contrasena(password)
    if mensaje:
        return JsonResponse({"error": mensaje}, status=400)

    # Se ingresa con el nombre de usuario; Django autentica con el correo
    # (USERNAME_FIELD), así que primero se busca a quién pertenece
    cuenta = buscar_por_nombre(nombre)
    usuario = authenticate(request, email=cuenta.email, password=password) if cuenta else None
    if usuario is None:
        return JsonResponse({"error": "El nombre de usuario o la contraseña son incorrectos."}, status=401)

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


# ---------------------------------------------------------------------------
# Configuración → Mi perfil: el usuario modifica sus propios datos
# ---------------------------------------------------------------------------

# Lo que cada uno puede cambiar de sí mismo. El documento, el rol, la campaña y
# el equipo los cambia la administración (Gestión → Usuarios); el nombre de
# usuario lo arma el sistema con el apellido y el nombre.
FOTO_TIPOS = ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")
FOTO_MAXIMO = 400_000  # caracteres (≈ 300 KB): el frontend la manda de 256 px


def _foto_perfil(u):
    return {
        "Usuario": u.username,
        "Email": u.email,
        "Nombre": u.first_name,
        "Apellido": u.last_name,
        "Teléfono": u.telefono or "",
        "Dirección": u.direccion or "",
    }


@require_http_methods(["PATCH"])
@requiere_sesion
def perfil(request):
    """PATCH {nombre, apellido, email, telefono, direccion}: solo cambia lo que se envía."""
    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    u = request.user

    def texto(campo, actual):
        return str(datos.get(campo, actual) or "").strip()

    nombre = espacios(texto("nombre", u.first_name))[:150]
    apellido = espacios(texto("apellido", u.last_name))[:150]
    email = texto("email", u.email).lower()
    telefono = espacios(texto("telefono", u.telefono))[:40]
    direccion = espacios(texto("direccion", u.direccion))[:300]
    if not nombre:
        return error("Ingrese el nombre.")
    mensaje = (
        nombre_persona(nombre)
        or nombre_persona(apellido, "El apellido")
        or validar_email(email)
        or validar_telefono(telefono)
    )
    if mensaje:
        return error(mensaje)
    if Usuario.objects.filter(email__iexact=email).exclude(pk=u.pk).exists():
        return error("Ya existe un usuario con ese correo electrónico.")

    antes = _foto_perfil(u)
    u.first_name, u.last_name, u.email = nombre, apellido, email
    u.telefono, u.direccion = telefono or None, direccion or None
    u.username = username_libre(nombre, apellido, u)
    u.save()
    u.refresh_from_db()
    cambios = diferencias(antes, _foto_perfil(u))
    if cambios:
        registrar(request, u, "editar", cambios=cambios, detalle="Modificó sus datos desde Mi perfil",
                  campana=campana_activa(request))
    return JsonResponse({"usuario": usuario_json(request)})


@require_http_methods(["PUT", "DELETE"])
@requiere_sesion
def foto(request):
    """PUT {foto: "data:image/...;base64,..."} guarda la foto de perfil;
    DELETE la quita (vuelve a mostrarse la inicial)."""
    u = request.user
    if request.method == "DELETE":
        u.foto = None
        u.save(update_fields=["foto"])
        return JsonResponse({"usuario": usuario_json(request)})

    datos = leer_json(request)
    imagen = datos.get("foto") if datos else None
    if not isinstance(imagen, str) or not imagen.startswith(FOTO_TIPOS):
        return error("La foto debe ser una imagen JPG, PNG o WebP.")
    if len(imagen) > FOTO_MAXIMO:
        return error("La foto es demasiado grande.")
    # Se comprueba que el contenido sea de verdad una imagen (Pillow viene con matplotlib)
    try:
        from PIL import Image

        contenido = base64.b64decode(imagen.split(",", 1)[1], validate=True)
        with Image.open(io.BytesIO(contenido)) as img:
            img.verify()
            if max(img.size) > 1024:
                return error("La foto es demasiado grande.")
    except (binascii.Error, ValueError, OSError, SyntaxError):
        return error("El archivo no es una imagen válida.")
    u.foto = imagen
    u.save(update_fields=["foto"])
    return JsonResponse({"usuario": usuario_json(request)})
