"""API de cuestionarios: se guardan completos (título, preguntas y opciones)
en un solo pedido, como un formulario de Google Forms."""

from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, registrar
from .models import Categoria, Cuestionario, Opcion, Pregunta

MAX_PREGUNTAS = 15
MAX_OPCIONES = 30


def cuestionarios_de_campana(campana):
    """Cuestionarios que ve una campaña: los asignados a algún usuario de esa
    campaña y los que todavía no están asignados a nadie.

    SQL equivalente:
        SELECT DISTINCT c.* FROM cuestionarios c
        LEFT JOIN usuariosxcuestionarios uc ON uc.id_cuestionario = c.id_cuestionario
        LEFT JOIN usuarios u ON u.id = uc.id_usuario
        WHERE u.id_campana = %s OR uc.id_usuario IS NULL
    """
    return Cuestionario.objects.filter(Q(usuarios__campana=campana) | Q(usuarios__isnull=True)).distinct()


class DatosInvalidos(Exception):
    pass


def _resumen_json(c):
    return {
        "id": c.pk,
        "titulo": c.titulo,
        "descripcion": c.descripcion or "",
        "categoria": {"id": c.categoria_id, "nombre": c.categoria.nombre},
        "activo": c.activo,
        "creado_en": c.creado_en.isoformat(),
        "preguntas": c.cantidad_preguntas,
        "encuestas": c.cantidad_encuestas,
    }


def _detalle_json(c):
    encuestas = c.encuestas.count()
    return {
        "id": c.pk,
        "titulo": c.titulo,
        "descripcion": c.descripcion or "",
        "categoria": c.categoria_id,
        "activo": c.activo,
        "encuestas": encuestas,
        # Con encuestas cargadas, preguntas y opciones ya no se pueden cambiar
        "bloqueado": encuestas > 0,
        "preguntas": [
            {
                "id": p.pk,
                "enunciado": p.enunciado,
                "tipo": p.tipo,
                "obligatoria": p.obligatoria,
                "variable": p.variable(),
                "opciones": [{"id": o.pk, "texto": o.texto} for o in p.opciones.all()],
            }
            for p in c.preguntas.prefetch_related("opciones")
        ],
    }


def _texto(valor, campo, maximo=None, obligatorio=True):
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise DatosInvalidos(f"{campo} debe ser texto.")
    valor = valor.strip()
    if obligatorio and not valor:
        raise DatosInvalidos(f"Falta {campo.lower()}.")
    if maximo and len(valor) > maximo:
        raise DatosInvalidos(f"{campo} es muy largo (máximo {maximo} caracteres).")
    return valor


def _limpiar_cabecera(datos):
    titulo = _texto(datos.get("titulo"), "El título", 180)
    descripcion = _texto(datos.get("descripcion"), "La descripción", obligatorio=False)
    categoria_id = datos.get("categoria")
    if not categoria_id or not Categoria.objects.filter(pk=categoria_id).exists():
        raise DatosInvalidos("Elegí una categoría.")
    activo = datos.get("activo", True)
    if not isinstance(activo, bool):
        raise DatosInvalidos("El estado activo debe ser verdadero o falso.")
    return {"titulo": titulo, "descripcion": descripcion or None, "categoria_id": categoria_id, "activo": activo}


def _limpiar_preguntas(preguntas):
    if not isinstance(preguntas, list) or not preguntas:
        raise DatosInvalidos("Agregá al menos una pregunta.")
    if len(preguntas) > MAX_PREGUNTAS:
        raise DatosInvalidos(f"Un cuestionario puede tener hasta {MAX_PREGUNTAS} preguntas.")
    limpias = []
    for n, p in enumerate(preguntas, start=1):
        if not isinstance(p, dict):
            raise DatosInvalidos(f"La pregunta {n} no es válida.")
        enunciado = _texto(p.get("enunciado"), f"El texto de la pregunta {n}")
        # Las preguntas se responden eligiendo una sola opción
        tipo = p.get("tipo", Pregunta.Tipo.UNA_OPCION)
        if tipo != Pregunta.Tipo.UNA_OPCION:
            raise DatosInvalidos(f"El tipo de la pregunta {n} no es válido: las preguntas son de una sola opción.")
        crudas = p.get("opciones") or []
        if not isinstance(crudas, list):
            raise DatosInvalidos(f"Las opciones de la pregunta {n} no son válidas.")
        opciones = [
            _texto(o.get("texto") if isinstance(o, dict) else o, f"La opción {i} de la pregunta {n}", 300)
            for i, o in enumerate(crudas, start=1)
        ]
        if len(opciones) < 2:
            raise DatosInvalidos(f"La pregunta {n} necesita al menos 2 opciones.")
        if len(opciones) > MAX_OPCIONES:
            raise DatosInvalidos(f"La pregunta {n} puede tener hasta {MAX_OPCIONES} opciones.")
        if len({o.lower() for o in opciones}) != len(opciones):
            raise DatosInvalidos(f"La pregunta {n} tiene opciones repetidas.")
        limpias.append(
            {"enunciado": enunciado, "tipo": tipo, "obligatoria": bool(p.get("obligatoria")), "opciones": opciones}
        )
    return limpias


def _crear_preguntas(cuestionario, preguntas):
    for orden, p in enumerate(preguntas, start=1):
        pregunta = Pregunta.objects.create(
            cuestionario=cuestionario,
            enunciado=p["enunciado"],
            tipo=p["tipo"],
            obligatoria=p["obligatoria"],
            orden=orden,
        )
        Opcion.objects.bulk_create(
            [Opcion(pregunta=pregunta, texto=texto, orden=i) for i, texto in enumerate(p["opciones"], start=1)]
        )


def _foto(c):
    return {
        "Título": c.titulo,
        "Descripción": c.descripcion or "",
        "Categoría": c.categoria.nombre,
        "Activo": "Sí" if c.activo else "No",
        # Las preguntas se resumen: "1. ¿…? (Opción 1 / Opción 2)"
        "Preguntas": " | ".join(
            f"{p.orden}. {p.enunciado} ({' / '.join(o.texto for o in p.opciones.all())})"
            for p in c.preguntas.prefetch_related("opciones")
        ),
    }


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("cuestionario"))
def cuestionarios(request):
    if request.method == "GET":
        lista = (
            cuestionarios_de_campana(request.campana)
            .select_related("categoria")
            .annotate(
                cantidad_preguntas=Count("preguntas", distinct=True),
                cantidad_encuestas=Count("encuestas", distinct=True),
            )
            .order_by("-creado_en")
        )
        return JsonResponse({"cuestionarios": [_resumen_json(c) for c in lista]})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    try:
        cabecera = _limpiar_cabecera(datos)
        preguntas = _limpiar_preguntas(datos.get("preguntas"))
    except DatosInvalidos as e:
        return error(str(e))
    with transaction.atomic():
        cuestionario = Cuestionario.objects.create(**cabecera)
        _crear_preguntas(cuestionario, preguntas)
    registrar(
        request, cuestionario, "crear",
        detalle=f"Creó el cuestionario {cuestionario.titulo} con {len(preguntas)} pregunta(s)",
    )
    return JsonResponse({"cuestionario": _detalle_json(cuestionario)}, status=201)


@require_http_methods(["GET", "PUT", "DELETE"])
@requiere_permiso(crud("cuestionario"))
def cuestionario_detalle(request, pk):
    cuestionario = get_object_or_404(cuestionarios_de_campana(request.campana), pk=pk)

    if request.method == "GET":
        return JsonResponse({"cuestionario": _detalle_json(cuestionario)})

    if request.method == "DELETE":
        if cuestionario.encuestas.exists():
            return error("No se puede borrar: ya tiene encuestas cargadas. Podés desactivarlo.", 409)
        if cuestionario.usuarios.exists():
            return error("No se puede borrar: está asignado a usuarios. Quitá las asignaciones primero.", 409)
        cuestionario.delete()  # preguntas y opciones se borran en cascada
        registrar(request, cuestionario, "borrar", detalle=f"Borró el cuestionario {cuestionario.titulo}")
        return JsonResponse({"ok": True})

    # PUT: reemplaza el cuestionario completo
    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    bloqueado = cuestionario.encuestas.exists()
    try:
        cabecera = _limpiar_cabecera(datos)
        preguntas = None if bloqueado else _limpiar_preguntas(datos.get("preguntas"))
    except DatosInvalidos as e:
        return error(str(e))
    antes = _foto(cuestionario)
    with transaction.atomic():
        for campo, valor in cabecera.items():
            setattr(cuestionario, campo, valor)
        cuestionario.save()
        if preguntas is not None:
            cuestionario.preguntas.all().delete()
            _crear_preguntas(cuestionario, preguntas)
    cuestionario.refresh_from_db()
    cambios = diferencias(antes, _foto(cuestionario))
    if cambios:
        registrar(request, cuestionario, "editar", cambios=cambios)
    return JsonResponse({"cuestionario": _detalle_json(cuestionario)})
