"""Carga de encuestas (vista del militante) y estadísticas por pregunta
(vista de la administración)."""

from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from . import graficos
from .api import error, leer_json, permisos_de, requiere_permiso
from .bitacora import registrar
from .models import Barrio, Cuestionario, Encuesta, Encuestado, Pregunta, RespuestaCargada



def _cuestionario_para_responder(c):
    return {
        "id": c.pk,
        "titulo": c.titulo,
        "descripcion": c.descripcion or "",
        "categoria": c.categoria.nombre,
        "preguntas": [
            {
                "id": p.pk,
                "enunciado": p.enunciado,
                "tipo": p.tipo,
                "obligatoria": p.obligatoria,
                "opciones": [{"id": o.pk, "texto": o.texto} for o in p.opciones.all()],
            }
            for p in c.preguntas.prefetch_related("opciones")
        ],
    }


def _para_responder(request):
    """Cuestionarios activos de la campaña que el usuario puede responder: los
    que tiene asignados. Quien administra cuestionarios los ve todos."""
    lista = Cuestionario.objects.filter(activo=True, campana=request.campana)
    if "core.view_cuestionario" not in permisos_de(request.user):
        lista = lista.filter(usuarios=request.user)
    return lista


@require_http_methods(["GET"])
@requiere_permiso("core.add_encuesta")
def cuestionarios_para_responder(request):
    lista = _para_responder(request).select_related("categoria").order_by("titulo")
    return JsonResponse({
        "cuestionarios": [
            {
                "id": c.pk,
                "titulo": c.titulo,
                "descripcion": c.descripcion or "",
                "categoria": c.categoria.nombre,
                "preguntas": c.preguntas.count(),
            }
            for c in lista
        ]
    })


class RespuestaInvalida(Exception):
    pass


def _limpiar_encuestado(datos):
    if not isinstance(datos, dict):
        raise RespuestaInvalida("Faltan los datos de la persona encuestada.")
    documento = str(datos.get("documento") or "").replace(".", "").replace(" ", "").strip()
    if not documento:
        raise RespuestaInvalida("Falta el documento de la persona encuestada.")
    if len(documento) > 30:
        raise RespuestaInvalida("El documento es muy largo.")
    limpio = {"documento": documento}
    # A la persona encuestada solo se le pide documento, nombre y apellido
    for campo, maximo in (("nombre", 100), ("apellido", 100)):
        valor = str(datos.get(campo) or "").strip()[:maximo]
        if valor:
            limpio[campo] = valor
    barrio = datos.get("barrio")
    if barrio:
        if not Barrio.objects.filter(pk=barrio).exists():
            raise RespuestaInvalida("El barrio elegido no existe.")
        limpio["barrio_id"] = barrio
    return limpio


def _limpiar_respuestas(cuestionario, respuestas):
    """Cada respuesta es {pregunta, opciones: [ids]}. "Una sola opción" admite
    exactamente una; "opción múltiple", una o más."""
    if not isinstance(respuestas, list):
        raise RespuestaInvalida("Las respuestas no son válidas.")
    por_pregunta = {}
    for r in respuestas:
        if isinstance(r, dict) and r.get("pregunta") is not None:
            por_pregunta[r["pregunta"]] = r.get("opciones") or []

    limpias = []
    for n, pregunta in enumerate(cuestionario.preguntas.prefetch_related("opciones"), start=1):
        elegidas = por_pregunta.get(pregunta.pk, [])
        if not isinstance(elegidas, list):
            raise RespuestaInvalida(f"La respuesta de la pregunta {n} no es válida.")
        elegidas = list(dict.fromkeys(elegidas))  # sin repetidas, en orden
        if not elegidas:
            if pregunta.obligatoria:
                raise RespuestaInvalida(f"Falta responder la pregunta {n}.")
            continue
        if pregunta.tipo == Pregunta.Tipo.UNA_OPCION and len(elegidas) > 1:
            raise RespuestaInvalida(f"En la pregunta {n} se elige una sola opción.")
        validas = {o.pk for o in pregunta.opciones.all()}
        if not all(o in validas for o in elegidas):
            raise RespuestaInvalida(f"La opción elegida en la pregunta {n} no es válida.")
        limpias += [RespuestaCargada(opcion_id=o) for o in elegidas]
    return limpias


def _coordenada(valor, minimo, maximo):
    try:
        numero = round(Decimal(str(valor)), 6)
    except (InvalidOperation, TypeError, ValueError):
        return None
    return numero if numero.is_finite() and minimo <= numero <= maximo else None


@require_http_methods(["GET", "POST"])
@requiere_permiso("core.add_encuesta")
def responder(request, pk):
    cuestionario = get_object_or_404(_para_responder(request).select_related("categoria"), pk=pk)
    if request.method == "GET":
        return JsonResponse({"cuestionario": _cuestionario_para_responder(cuestionario)})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    try:
        encuestado_datos = _limpiar_encuestado(datos.get("encuestado"))
        respuestas = _limpiar_respuestas(cuestionario, datos.get("respuestas"))
    except RespuestaInvalida as e:
        return error(str(e))
    if not respuestas:
        return error("Respondé al menos una pregunta.")

    latitud = _coordenada(datos.get("latitud"), -90, 90)
    longitud = _coordenada(datos.get("longitud"), -180, 180)
    if latitud is None or longitud is None:
        latitud = longitud = None

    documento = encuestado_datos.pop("documento")
    try:
        with transaction.atomic():
            encuestado, creado = Encuestado.objects.get_or_create(documento=documento, defaults=encuestado_datos)
            if not creado and encuestado_datos:
                # Completa o actualiza los datos que se cargaron ahora
                for campo, valor in encuestado_datos.items():
                    setattr(encuestado, campo, valor)
                encuestado.save()
            encuesta = Encuesta.objects.create(
                encuestado=encuestado,
                cuestionario=cuestionario,
                usuario=request.user,
                latitud=latitud,
                longitud=longitud,
            )
            RespuestaCargada.objects.bulk_create(respuestas)
    except IntegrityError:
        return error("Esta persona ya respondió este cuestionario.", 409)
    registrar(
        request, encuesta, "crear",
        detalle=f"Cargó una encuesta de {cuestionario.titulo} (documento {encuestado.documento})",
    )
    return JsonResponse({"ok": True, "encuesta": encuesta.pk}, status=201)


# ---------------------------------------------------------------------------
# Estadísticas
# ---------------------------------------------------------------------------


@require_http_methods(["GET"])
@requiere_permiso("core.view_cuestionario", "core.view_encuesta")
def estadisticas(request, pk):
    cuestionario = get_object_or_404(Cuestionario.objects.select_related("categoria"), pk=pk, campana=request.campana)
    total = cuestionario.encuestas.count()
    ultima = cuestionario.encuestas.order_by("-realizada_en").values_list("realizada_en", flat=True).first()
    # Todas las respuestas en un DataFrame de pandas; de ahí salen las frecuencias
    respuestas = graficos.respuestas_de(cuestionario)

    preguntas = []
    for p in cuestionario.preguntas.prefetch_related("opciones"):
        tabla, variable, respondidas = graficos.tabla_de(p, respuestas)
        tabla["porcentaje"] = (100 * tabla["cantidad"] / respondidas).round(1) if respondidas else 0
        dato = {
            "id": p.pk,
            "enunciado": p.enunciado,
            "tipo": p.tipo,
            "variable": variable,
            "obligatoria": p.obligatoria,
            "respondidas": respondidas,
            "sin_responder": total - respondidas,
            "elecciones": int(tabla["cantidad"].sum()),
            "opciones": tabla.to_dict("records"),
        }
        if variable == Pregunta.Variable.CUANTITATIVA:
            dato["medidas"] = graficos.medidas(tabla)
        preguntas.append(dato)

    return JsonResponse({
        "cuestionario": {"id": cuestionario.pk, "titulo": cuestionario.titulo, "categoria": cuestionario.categoria.nombre},
        "total_encuestas": total,
        "ultima_encuesta": ultima.isoformat() if ultima else None,
        "militantes": cuestionario.encuestas.exclude(usuario=None).values("usuario").distinct().count(),
        "preguntas": preguntas,
    })


@require_http_methods(["GET"])
@requiere_permiso("core.view_cuestionario", "core.view_encuesta")
def grafico(request, pk, pregunta, clave):
    """Imagen PNG de un gráfico de una pregunta, hecha con pandas y matplotlib."""
    if clave not in graficos.GRAFICOS:
        return error("Ese gráfico no existe.", 404)
    cuestionario = get_object_or_404(Cuestionario, pk=pk, campana=request.campana)
    p = get_object_or_404(cuestionario.preguntas.prefetch_related("opciones"), pk=pregunta)
    tabla, _, respondidas = graficos.tabla_de(p, graficos.respuestas_de(cuestionario))
    respuesta = HttpResponse(graficos.grafico_png(clave, tabla, respondidas), content_type="image/png")
    respuesta["Cache-Control"] = "private, no-cache"
    return respuesta
