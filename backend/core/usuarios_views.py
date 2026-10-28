"""Usuarios de la campaña activa, vista (solo lectura) de los permisos de
Django por grupo e historial de actividad (registro de Django, LogEntry)."""

import re
from datetime import date, datetime, time

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.password_validation import validate_password
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.core.validators import validate_email
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .api import ADMINISTRAR, SOLO_SUPERUSUARIO, crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, leer, registrar
from .models import Militante, Usuario

GRUPO_MILITANTES = "Militantes"
ACCIONES = {"view": "Ver", "add": "Crear", "change": "Editar", "delete": "Borrar"}
SECCIONES_EXTRA = {"group": "Grupos", "permission": "Permisos", "logentry": "Historial de actividad"}
POR_PAGINA = 50


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------


def _usuario_json(u):
    militante = getattr(u, "militante", None)
    return {
        "id": u.pk,
        "email": u.email,
        "nombre": u.first_name,
        "apellido": u.last_name,
        "activo": u.is_active,
        "es_superusuario": u.is_superuser,
        "grupos": [{"id": g.pk, "nombre": g.name} for g in u.groups.all()],
        "administra": _administra(u),
        "militante": {"documento": militante.documento or "", "telefono": militante.telefono or ""}
        if militante
        else None,
        "ultimo_ingreso": u.last_login.isoformat() if u.last_login else None,
        "alta": u.date_joined.isoformat(),
    }


def _permiso_administrar():
    app, codename = ADMINISTRAR.split(".")
    return Permission.objects.get(content_type__app_label=app, codename=codename)


def _administra(u):
    """Tiene el permiso propio "administrar_campana" (directo, no por grupo)."""
    return u.user_permissions.filter(codename="administrar_campana").exists()


def _foto(u):
    militante = getattr(u, "militante", None)
    return {
        "Administra la campaña": "Sí" if _administra(u) else "No",
        "Email": u.email,
        "Nombre": u.first_name,
        "Apellido": u.last_name,
        "Activo": "Sí" if u.is_active else "No",
        "Grupos": ", ".join(sorted(u.groups.values_list("name", flat=True))),
        "Documento": (militante.documento or "") if militante else "",
        "Teléfono": (militante.telefono or "") if militante else "",
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
    try:
        validate_email(email)
    except ValidationError:
        return None, "Ingresá un email válido."
    repetido = Usuario.objects.filter(email__iexact=email)
    if usuario:
        repetido = repetido.exclude(pk=usuario.pk)
    if repetido.exists():
        return None, "Ya existe un usuario con ese email."

    nombre = str(datos.get("nombre", usuario.first_name if usuario else "") or "").strip()[:150]
    apellido = str(datos.get("apellido", usuario.last_name if usuario else "") or "").strip()[:150]
    if not nombre:
        return None, "Poné el nombre."

    password = datos.get("password") or ""
    if not usuario and not password:
        return None, "Poné una contraseña."
    if password:
        try:
            validate_password(password, usuario)
        except ValidationError as e:
            return None, " ".join(e.messages)

    grupos_ids = datos.get("grupos")
    if grupos_ids is None:
        grupos = list(usuario.groups.all()) if usuario else []
    else:
        if not isinstance(grupos_ids, list):
            return None, "Los grupos no son válidos."
        grupos = list(Group.objects.filter(pk__in=grupos_ids))
        if len(grupos) != len(set(grupos_ids)):
            return None, "Alguno de los grupos no existe."
    administra = datos.get("administra", _administra(usuario) if usuario else False)
    if not isinstance(administra, bool):
        return None, "El permiso de administrar debe ser verdadero o falso."
    if not grupos and not administra:
        return None, "Elegí qué puede hacer: administrar la campaña o un grupo (por ejemplo, Militantes)."

    activo = datos.get("activo", usuario.is_active if usuario else True)
    if not isinstance(activo, bool):
        return None, "El estado debe ser verdadero o falso."

    militante = datos.get("militante") or {}
    if not isinstance(militante, dict):
        return None, "Los datos de militante no son válidos."
    documento = str(militante.get("documento") or "").replace(".", "").replace(" ", "").strip()[:30]
    if documento and Militante.objects.filter(documento=documento).exclude(usuario=usuario).exists():
        return None, "Ya hay un militante con ese documento."

    return {
        "email": email,
        "nombre": nombre,
        "apellido": apellido,
        "password": password,
        "grupos": grupos,
        "administra": administra,
        "activo": activo,
        "documento": documento or None,
        "telefono": str(militante.get("telefono") or "").strip()[:40] or None,
    }, None


def _guardar(usuario, d):
    usuario.email = d["email"]
    usuario.first_name = d["nombre"]
    usuario.last_name = d["apellido"]
    usuario.is_active = d["activo"]
    if d["password"]:
        usuario.set_password(d["password"])
    usuario.save()
    usuario.groups.set(d["grupos"])
    # El permiso propio va directo al usuario (tabla usuarios_user_permissions)
    if d["administra"]:
        usuario.user_permissions.add(_permiso_administrar())
    else:
        usuario.user_permissions.remove(_permiso_administrar())
    # Quien está en el grupo Militantes tiene su ficha de militante
    if any(g.name == GRUPO_MILITANTES for g in d["grupos"]) or hasattr(usuario, "militante"):
        militante, _ = Militante.objects.get_or_create(
            usuario=usuario, defaults={"nombre": d["nombre"], "apellido": d["apellido"] or "-"}
        )
        militante.nombre = d["nombre"]
        militante.apellido = d["apellido"] or "-"
        militante.documento = d["documento"]
        militante.telefono = d["telefono"]
        militante.activo = d["activo"]
        militante.save()


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("usuario"))
def usuarios(request):
    if request.method == "GET":
        lista = (
            Usuario.objects.filter(campana=request.campana)
            .prefetch_related("groups")
            .select_related("militante")
            .order_by("-is_active", "first_name", "last_name")
        )
        return JsonResponse({
            "usuarios": [_usuario_json(u) for u in lista],
            "grupos": [
                {"id": g.pk, "nombre": g.name, "descripcion": g.ficha.descripcion if hasattr(g, "ficha") else ""}
                for g in Group.objects.select_related("ficha").order_by("name")
            ],
        })

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    limpios, mensaje = _limpiar(datos)
    if mensaje:
        return error(mensaje)
    with transaction.atomic():
        usuario = Usuario(username=_username_libre(limpios["email"]), campana=request.campana)
        _guardar(usuario, limpios)
    registrar(request, usuario, "crear", detalle=f"Creó el usuario {usuario.email}")
    return JsonResponse({"usuario": _usuario_json(usuario)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("usuario"))
def usuario_detalle(request, pk):
    usuario = get_object_or_404(Usuario, pk=pk, campana=request.campana)
    if usuario.is_superuser and not request.user.is_superuser:
        return error("Solo un superusuario puede modificar a otro superusuario.", 403)

    if request.method == "DELETE":
        # No se borra: se desactiva, así se conserva su historial y sus encuestas
        if usuario.pk == request.user.pk:
            return error("No podés desactivar tu propio usuario.", 409)
        antes = _foto(usuario)
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        Militante.objects.filter(usuario=usuario).update(activo=False)
        registrar(request, usuario, "editar", cambios=diferencias(antes, _foto(usuario)), detalle="Desactivó el usuario")
        return JsonResponse({"usuario": _usuario_json(usuario)})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    if usuario.pk == request.user.pk and datos.get("activo") is False:
        return error("No podés desactivar tu propio usuario.", 409)
    limpios, mensaje = _limpiar(datos, usuario)
    if mensaje:
        return error(mensaje)
    antes = _foto(usuario)
    with transaction.atomic():
        _guardar(usuario, limpios)
    usuario.refresh_from_db()
    cambios = diferencias(antes, _foto(usuario))
    if limpios["password"]:
        cambios.append({"campo": "Contraseña", "antes": "••••", "despues": "(cambiada)"})
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
    todos = Permission.objects.select_related("content_type")
    grupos = Group.objects.prefetch_related("permissions__content_type").order_by("name")
    usuarios = (
        Usuario.objects.filter(campana=request.campana, is_active=True)
        .prefetch_related("groups", "user_permissions")
        .order_by("first_name")
    )
    return JsonResponse({
        "secciones": _agrupar(todos),
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
                "grupos": [g.name for g in u.groups.all()],
                "directos": _agrupar(u.user_permissions.all()),
            }
            for u in usuarios
        ],
        # Qué incluye el permiso propio "Puede administrar la campaña"
        "administrar": _agrupar(
            Permission.objects.filter(
                content_type__app_label="core"
            ).exclude(codename__in=SOLO_SUPERUSUARIO | {"administrar_campana"}).select_related("content_type")
            | Permission.objects.filter(
                content_type__app_label__in=["auth", "admin"],
                codename__in=["view_group", "view_permission", "view_logentry"],
            ).select_related("content_type")
        ),
        "propios": [
            {"codigo": f"core.{p.codename}", "nombre": p.name, "usuarios": p.user_set.filter(campana=request.campana).count()}
            for p in Permission.objects.filter(content_type__app_label="core", codename__in=["administrar_campana", "elegir_campana"])
        ],
        "superusuario": "El superusuario tiene todos los permisos, sin importar sus grupos.",
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
    consulta = LogEntry.objects.select_related("user", "content_type").order_by("-action_time")
    # Solo lo de la campaña activa; el superusuario puede ver todo
    if not (request.user.is_superuser and request.GET.get("alcance") == "todas"):
        consulta = consulta.filter(change_message__regex=rf'"campana": {request.campana.pk}[,}}]')

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
    if g.get("q"):
        consulta = consulta.filter(object_repr__icontains=g["q"].strip())

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