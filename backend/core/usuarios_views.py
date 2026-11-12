"""Usuarios de la campaña activa, vista (solo lectura) de los permisos de
Django por rol e historial de actividad (registro de Django, LogEntry).

Al crear un usuario no se escribe contraseña: se le envía por correo una
invitación para que la elija (ver contrasenas_views)."""

import re
from datetime import date, datetime, time

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Group
from django.contrib.contenttypes.models import ContentType
from django.core.paginator import Paginator
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, leer, registrar
from .contrasenas_views import enviar_enlace_a
from .models import Usuario
from .validaciones import documento as validar_documento
from .validaciones import email as validar_email
from .validaciones import espacios, nombre_persona
from .validaciones import telefono as validar_telefono

ACCIONES = {"view": "Ver", "add": "Crear", "change": "Editar", "delete": "Borrar"}
SECCIONES_EXTRA = {"group": "Roles", "permission": "Permisos", "logentry": "Historial de actividad"}
POR_PAGINA = 15


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------


def _usuario_json(u):
    return {
        "id": u.pk,
        "email": u.email,
        "nombre": u.first_name,
        "apellido": u.last_name,
        "activo": u.is_active,
        "es_superusuario": u.is_superuser,
        "grupos": [{"id": g.pk, "nombre": g.name} for g in u.groups.all()],
        "grupo": u.grupo_id,
        "documento": u.documento or "",
        "telefono": u.telefono or "",
        "direccion": u.direccion or "",
        "ultimo_ingreso": u.last_login.isoformat() if u.last_login else None,
        "alta": u.date_joined.isoformat(),
    }


def _foto(u):
    return {
        "Email": u.email,
        "Nombre": u.first_name,
        "Apellido": u.last_name,
        "Activo": "Sí" if u.is_active else "No",
        "Rol": ", ".join(sorted(u.groups.values_list("name", flat=True))),
        "Documento": u.documento or "",
        "Teléfono": u.telefono or "",
        "Dirección": u.direccion or "",
    }


def _username_libre(email):
    base = re.sub(r"[^\w.@+-]", "", email.split("@")[0])[:140] or "usuario"
    nombre, n = base, 1
    while Usuario.objects.filter(username=nombre).exists():
        n += 1
        nombre = f"{base}{n}"
    return nombre


def _limpiar(datos, usuario=None):
    """Valida los datos del formulario. Devuelve (dict, None) o (None, mensaje)."""
    email = str(datos.get("email", usuario.email if usuario else "") or "").strip().lower()
    mensaje = validar_email(email)
    if mensaje:
        return None, mensaje
    repetido = Usuario.objects.filter(email__iexact=email)
    if usuario:
        repetido = repetido.exclude(pk=usuario.pk)
    if repetido.exists():
        return None, "Ya existe un usuario con ese correo electrónico."

    nombre = espacios(str(datos.get("nombre", usuario.first_name if usuario else "") or ""))[:150]
    apellido = espacios(str(datos.get("apellido", usuario.last_name if usuario else "") or ""))[:150]
    if not nombre:
        return None, "Ingrese el nombre."
    mensaje = nombre_persona(nombre) or nombre_persona(apellido, "El apellido")
    if mensaje:
        return None, mensaje

    grupos_ids = datos.get("grupos")
    if grupos_ids is None:
        grupos = list(usuario.groups.all()) if usuario else []
    else:
        if not isinstance(grupos_ids, list):
            return None, "El rol seleccionado no es válido."
        grupos = list(Group.objects.filter(pk__in=grupos_ids))
        if len(grupos) != len(set(grupos_ids)):
            return None, "El rol seleccionado no existe."
    # Un usuario tiene un solo rol (usuarios.id_grupo)
    if len(grupos) > 1:
        return None, "Seleccione un solo rol."
    if not grupos and not (usuario and usuario.is_superuser):
        return None, "Seleccione el rol del usuario."

    activo = datos.get("activo", usuario.is_active if usuario else True)
    if not isinstance(activo, bool):
        return None, "El estado no es válido."

    # Datos de la persona: directo en el usuario (antes en la tabla militantes)
    def dato(campo):
        valor = datos.get(campo, getattr(usuario, campo) if usuario else "")
        return str(valor or "").strip()

    documento = dato("documento").replace(".", "").replace(" ", "")[:30]
    telefono_ = espacios(dato("telefono"))[:40]
    mensaje = validar_documento(documento) or validar_telefono(telefono_)
    if mensaje:
        return None, mensaje
    repetido = Usuario.objects.filter(documento=documento)
    if usuario:
        repetido = repetido.exclude(pk=usuario.pk)
    if documento and repetido.exists():
        return None, "Ya existe un usuario con ese documento."

    return {
        "email": email,
        "nombre": nombre,
        "apellido": apellido,
        "grupos": grupos,
        "activo": activo,
        "documento": documento or None,
        "telefono": telefono_ or None,
        "direccion": dato("direccion") or None,
    }, None


def _guardar(usuario, d):
    usuario.email = d["email"]
    usuario.first_name = d["nombre"]
    usuario.last_name = d["apellido"]
    usuario.is_active = d["activo"]
    usuario.documento = d["documento"]
    usuario.telefono = d["telefono"]
    usuario.direccion = d["direccion"]
    # usuarios.id_grupo apunta al grupo de Django (auth_group) elegido
    usuario.grupo = d["grupos"][0] if d["grupos"] else None
    usuario.save()
    usuario.groups.set(d["grupos"])


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("usuario"))
def usuarios(request):
    if request.method == "GET":
        lista = (
            Usuario.objects.filter(campana=request.campana)
            .prefetch_related("groups")
            .order_by("-is_active", "first_name", "last_name")
        )
        return JsonResponse({
            "usuarios": [_usuario_json(u) for u in lista],
            "grupos": [
                {"id": g.pk, "nombre": g.name}
                for g in Group.objects.order_by("name")
            ],
        })

    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    limpios, mensaje = _limpiar(datos)
    if mensaje:
        return error(mensaje)
    with transaction.atomic():
        usuario = Usuario(username=_username_libre(limpios["email"]), campana=request.campana)
        # Sin contraseña hasta que la elija desde la invitación
        usuario.set_unusable_password()
        _guardar(usuario, limpios)
    registrar(request, usuario, "crear", detalle=f"Creó el usuario {usuario.email}")
    destino, aviso = enviar_enlace_a(usuario, request.user, invitacion=True) if usuario.is_active else (None, None)
    return JsonResponse(
        {"usuario": _usuario_json(usuario), "invitacion": destino, "aviso_invitacion": aviso},
        status=201,
    )


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("usuario"))
def usuario_detalle(request, pk):
    usuario = get_object_or_404(Usuario, pk=pk, campana=request.campana)
    if usuario.is_superuser and not request.user.is_superuser:
        return error("Solo un superusuario puede modificar a otro superusuario.", 403)

    if request.method == "DELETE":
        # No se borra: se desactiva, así se conserva su historial y sus encuestas
        if usuario.pk == request.user.pk:
            return error("No puede desactivar su propio usuario.", 409)
        antes = _foto(usuario)
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        registrar(request, usuario, "editar", cambios=diferencias(antes, _foto(usuario)), detalle="Desactivó el usuario")
        return JsonResponse({"usuario": _usuario_json(usuario)})

    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    if usuario.pk == request.user.pk and datos.get("activo") is False:
        return error("No puede desactivar su propio usuario.", 409)
    limpios, mensaje = _limpiar(datos, usuario)
    if mensaje:
        return error(mensaje)
    antes = _foto(usuario)
    with transaction.atomic():
        _guardar(usuario, limpios)
    usuario.refresh_from_db()
    cambios = diferencias(antes, _foto(usuario))
    if cambios:
        registrar(request, usuario, "editar", cambios=cambios)
    return JsonResponse({"usuario": _usuario_json(usuario)})


# ---------------------------------------------------------------------------
# Permisos (solo lectura)
# ---------------------------------------------------------------------------


def _seccion(permiso):
    modelo = permiso.content_type.model_class()
    if permiso.content_type.model in SECCIONES_EXTRA:
        return SECCIONES_EXTRA[permiso.content_type.model]
    return modelo._meta.verbose_name_plural.capitalize() if modelo else permiso.content_type.model


def _accion(permiso):
    prefijo = permiso.codename.split("_", 1)[0]
    return ACCIONES.get(prefijo, permiso.name)


def _relevante(permiso):
    app = permiso.content_type.app_label
    return app == "core" or permiso.content_type.model in SECCIONES_EXTRA


def _agrupar(permisos):
    """{sección: [acciones]} con un orden fijo de acciones."""
    orden = list(ACCIONES.values())
    secciones = {}
    for p in permisos:
        if _relevante(p):
            secciones.setdefault(_seccion(p), []).append(_accion(p))
    return [
        {"seccion": s, "acciones": sorted(a, key=lambda x: orden.index(x) if x in orden else 99)}
        for s, a in sorted(secciones.items())
    ]


@require_http_methods(["GET"])
@requiere_permiso("auth.view_group")
def permisos(request):
    """Qué permite cada rol, por sección (la pantalla muestra un rol por vez)."""
    grupos = Group.objects.prefetch_related("permissions__content_type").order_by("name")
    usuarios = (
        Usuario.objects.filter(campana=request.campana, is_active=True)
        .prefetch_related("groups")
        .order_by("first_name")
    )
    return JsonResponse({
        "grupos": [
            {
                "id": g.pk,
                "nombre": g.name,
                "usuarios": g.user_set.filter(campana=request.campana).count(),
                "permisos": _agrupar(g.permissions.all()),
            }
            for g in grupos
        ],
        "usuarios": [
            {
                "id": u.pk,
                "nombre": f"{u.first_name} {u.last_name}".strip() or u.email,
                "email": u.email,
                "superusuario": u.is_superuser,
                "grupos": [g.name for g in u.groups.all()],
            }
            for u in usuarios
        ],
    })


# ---------------------------------------------------------------------------
# Historial de actividad
# ---------------------------------------------------------------------------


def _fecha(texto, fin=False):
    try:
        dia = date.fromisoformat(texto)
    except (TypeError, ValueError):
        return None
    return timezone.make_aware(datetime.combine(dia, time.max if fin else time.min))


@require_http_methods(["GET"])
@requiere_permiso("admin.view_logentry")
def historial(request):
    # Solo lo de la campaña activa: como el resto del sistema, se trabaja
    # dentro de una campaña (y no hace falta guardar nada nuevo en la base)
    consulta = (
        LogEntry.objects.select_related("user", "content_type")
        .filter(change_message__regex=rf'"campana": {request.campana.pk}[,}}]')
        .order_by("-action_time")
    )

    g = request.GET
    if g.get("usuario"):
        consulta = consulta.filter(user_id=g["usuario"])
    if g.get("seccion"):
        consulta = consulta.filter(content_type_id=g["seccion"])
    if g.get("accion") in ("crear", "editar", "borrar", "sesion"):
        consulta = consulta.filter(change_message__contains=f'"accion": "{g["accion"]}"')
    if _fecha(g.get("desde")):
        consulta = consulta.filter(action_time__gte=_fecha(g["desde"]))
    if _fecha(g.get("hasta")):
        consulta = consulta.filter(action_time__lte=_fecha(g["hasta"], fin=True))

    pagina = Paginator(consulta, POR_PAGINA).get_page(g.get("pagina"))
    usuarios_filtro = Usuario.objects.filter(pk__in=consulta.values("user_id")).order_by("first_name")
    secciones = {}
    for id_tipo in consulta.order_by().values_list("content_type_id", flat=True).distinct():
        ct = ContentType.objects.get_for_id(id_tipo)
        modelo = ct.model_class()
        secciones[ct.pk] = modelo._meta.verbose_name.capitalize() if modelo else ct.model
    return JsonResponse({
        "movimientos": [leer(e) for e in pagina.object_list],
        "pagina": pagina.number,
        "paginas": pagina.paginator.num_pages,
        "total": pagina.paginator.count,
        "filtros": {
            "usuarios": [{"id": u.pk, "nombre": f"{u.first_name} {u.last_name}".strip() or u.email} for u in usuarios_filtro],
            "secciones": [{"id": k, "nombre": v} for k, v in sorted(secciones.items(), key=lambda x: x[1])],
        },
    })