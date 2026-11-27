import base64
import binascii
import io
import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .api import campana_activa, error, leer_json, permisos_de, puede_elegir_campana, requiere_sesion
from .bitacora import diferencias, registrar
from .contrasenas_views import SIN_ENVIO, buscar_por_nombre, enviar_verificacion_correo
from .limites import ip_de, limpiar, sumar, superado
from .models import Usuario, username_libre
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
        "grupos": [usuario.grupo.name] if usuario.grupo else [],
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
    # El token también va en el JSON: la app móvil (React Native) no puede leer las cookies
    return JsonResponse({"ok": True, "csrfToken": get_token(request)})


CREDENCIALES_INVALIDAS = "Credenciales inválidas. Por favor, verifique su usuario y contraseña."
DEMASIADOS_INTENTOS = "Demasiados intentos fallidos. Espere unos minutos e intente de nuevo."
LOGIN_MAX_POR_USUARIO = 5   # intentos fallidos con el mismo usuario...
LOGIN_MAX_POR_IP = 20       # ...o desde la misma IP...
LOGIN_VENTANA = 15 * 60     # ...en 15 minutos
CORREO_MAX_INTENTOS = 5     # contraseñas equivocadas al cambiar el correo, en 15 minutos
CONTRASENA_INCORRECTA = "La contraseña no es correcta. Su correo no se cambió."


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

    # Límite de intentos fallidos: por usuario y por IP (frena a quien prueba
    # contraseñas). Se avisa sin decir si el usuario existe.
    ip = ip_de(request)
    if superado("login-usuario", nombre, LOGIN_MAX_POR_USUARIO) or superado("login-ip", ip, LOGIN_MAX_POR_IP):
        return JsonResponse({"error": DEMASIADOS_INTENTOS}, status=429)

    # Se ingresa solo con el nombre de usuario (USERNAME_FIELD); con el correo
    # no se puede. Se busca la cuenta sin distinguir mayúsculas.
    # La regla de la contraseña (8 caracteres, etc.) no se revisa acá: se
    # exige al crearla o cambiarla. En el login, cualquier error da el mismo
    # mensaje, para no revelar si el usuario existe o si falló la contraseña.
    cuenta = buscar_por_nombre(nombre)
    usuario = authenticate(request, username=cuenta.username, password=password) if cuenta else None
    if usuario is None:
        sumar("login-usuario", nombre, LOGIN_VENTANA)
        sumar("login-ip", ip, LOGIN_VENTANA)
        return JsonResponse({"error": CREDENCIALES_INVALIDAS}, status=401)

    limpiar("login-usuario", nombre)
    login(request, usuario)
    if not datos.get("recordar"):
        # Sin "Recordar", la sesión termina al cerrar el navegador
        request.session.set_expiry(0)
    registrar(request, usuario, "sesion", detalle="Inició sesión", campana=usuario.campana)
    # login() rota el token CSRF: se devuelve el nuevo para la app móvil
    return JsonResponse({"usuario": usuario_json(request), "csrfToken": get_token(request)})


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
    """PATCH {nombre, apellido, email, telefono, direccion}: solo cambia lo que se envía.
    Para cambiar el correo hay que mandar también {password} (la contraseña de
    la cuenta). El correo nuevo no se guarda acá: se le envía un enlace y se
    guarda cuando la persona lo confirma (contrasenas_views.confirmar_correo)."""
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

    # Cambio de correo: con la contraseña de la cuenta, y queda pendiente hasta
    # que se confirme desde el enlace que le llega al correo nuevo
    correo_pendiente = None
    if email != (u.email or "").lower():
        clave = datos.get("password") or ""
        if superado("perfil-correo", str(u.pk), CORREO_MAX_INTENTOS):
            return error(DEMASIADOS_INTENTOS, 429)
        if not isinstance(clave, str) or not clave or not u.check_password(clave):
            sumar("perfil-correo", str(u.pk), LOGIN_VENTANA)
            return error(CONTRASENA_INCORRECTA, 400, codigo="contrasena")
        limpiar("perfil-correo", str(u.pk))
        mensaje = enviar_verificacion_correo(u, email)
        if mensaje:
            return error(mensaje, 502 if mensaje == SIN_ENVIO else 409)
        correo_pendiente = email

    antes = _foto_perfil(u)
    u.first_name, u.last_name = nombre, apellido
    u.telefono, u.direccion = telefono or None, direccion or None
    u.username = username_libre(nombre, apellido, u)
    u.save()
    u.refresh_from_db()
    cambios = diferencias(antes, _foto_perfil(u))
    if cambios:
        registrar(request, u, "editar", cambios=cambios, detalle="Modificó sus datos desde Mi perfil",
                  campana=campana_activa(request))
    if correo_pendiente:
        registrar(request, u, "editar", detalle=f"Pidió cambiar su correo a {correo_pendiente} (falta confirmarlo)",
                  campana=campana_activa(request))
    return JsonResponse({"usuario": usuario_json(request), "correo_pendiente": correo_pendiente})


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
