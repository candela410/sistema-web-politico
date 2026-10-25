"""Carga de encuestas (vista del militante) y estadísticas por pregunta
(vista de la administración)."""

import statistics
from collections import Counter
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import error, leer_json, requiere_admin, requiere_sesion
from .models import Barrio, Cuestionario, Encuesta, Encuestado, Pregunta, RespuestaCargada

MAX_TEXTO = 2000
ULTIMAS_RESPUESTAS_TEXTO = 30


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


@require_http_methods(["GET"])
@requiere_sesion
def cuestionarios_para_responder(request):
    lista = Cuestionario.objects.filter(activo=True).select_related("categoria").order_by("titulo")
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
    for campo, maximo in (("nombre", 100), ("apellido", 100), ("telefono", 40), ("direccion", 500)):
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
    if not isinstance(respuestas, list):
        raise RespuestaInvalida("Las respuestas no son válidas.")
    por_pregunta = {}
    for r in respuestas:
        if isinstance(r, dict) and r.get("pregunta") is not None:
            por_pregunta[r["pregunta"]] = r

    limpias = []
    for n, pregunta in enumerate(cuestionario.preguntas.prefetch_related("opciones"), start=1):
        r = por_pregunta.get(pregunta.pk, {})
        opcion_id, texto = r.get("opcion"), r.get("texto")
        texto = str(texto).strip() if texto is not None else ""

        if pregunta.tipo in (Pregunta.Tipo.OPCION_MULTIPLE, Pregunta.Tipo.SI_NO):
            if opcion_id is None:
                if pregunta.obligatoria:
                    raise RespuestaInvalida(f"Falta responder la pregunta {n}.")
                continue
            if opcion_id not in {o.pk for o in pregunta.opciones.all()}:
                raise RespuestaInvalida(f"La opción elegida en la pregunta {n} no es válida.")
            limpias.append(RespuestaCargada(pregunta=pregunta, opcion_id=opcion_id))
            continue

        if not texto:
            if pregunta.obligatoria:
                raise RespuestaInvalida(f"Falta responder la pregunta {n}.")
            continue
        if pregunta.tipo == Pregunta.Tipo.NUMERO:
            try:
                numero = Decimal(texto.replace(",", "."))
            except InvalidOperation:
                raise RespuestaInvalida(f"La respuesta de la pregunta {n} debe ser un número.") from None
            if not numero.is_finite():
                raise RespuestaInvalida(f"La respuesta de la pregunta {n} debe ser un número.")
            texto = format(numero.normalize(), "f")
        limpias.append(RespuestaCargada(pregunta=pregunta, respuesta_texto=texto[:MAX_TEXTO]))
    return limpias


def _coordenada(valor, minimo, maximo):
    try:
        numero = round(Decimal(str(valor)), 6)
    except (InvalidOperation, TypeError, ValueError):
        return None
    return numero if numero.is_finite() and minimo <= numero <= maximo else None


@require_http_methods(["GET", "POST"])
@requiere_sesion
def responder(request, pk):
    cuestionario = get_object_or_404(Cuestionario.objects.select_related("categoria"), pk=pk, activo=True)
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
                militante=getattr(request.user, "militante", None),
                latitud=latitud,
                longitud=longitud,
            )
            for r in respuestas:
                r.encuesta = encuesta
            RespuestaCargada.objects.bulk_create(respuestas)
    except IntegrityError:
        return error("Esta persona ya respondió este cuestionario.", 409)
    return JsonResponse({"ok": True, "encuesta": encuesta.pk}, status=201)


# ---------------------------------------------------------------------------
# Estadísticas
# ---------------------------------------------------------------------------


def _numero(texto):
    try:
        return float(texto.replace(",", "."))
    except (AttributeError, ValueError):
        return None


@require_http_methods(["GET"])
@requiere_admin
def estadisticas(request, pk):
    cuestionario = get_object_or_404(Cuestionario.objects.select_related("categoria"), pk=pk)
    total = cuestionario.encuestas.count()
    ultima = cuestionario.encuestas.order_by("-realizada_en").values_list("realizada_en", flat=True).first()

    preguntas = []
    for p in cuestionario.preguntas.prefetch_related("opciones"):
        respuestas = RespuestaCargada.objects.filter(pregunta=p)
        respondidas = respuestas.count()
        dato = {
            "id": p.pk,
            "enunciado": p.enunciado,
            "tipo": p.tipo,
            "obligatoria": p.obligatoria,
            "respondidas": respondidas,
            "sin_responder": total - respondidas,
        }
        if p.tipo in (Pregunta.Tipo.OPCION_MULTIPLE, Pregunta.Tipo.SI_NO):
            conteo = Counter(respuestas.values_list("opcion_id", flat=True))
            dato["opciones"] = [
                {
                    "id": o.pk,
                    "texto": o.texto,
                    "cantidad": conteo.get(o.pk, 0),
                    "porcentaje": round(100 * conteo.get(o.pk, 0) / respondidas, 1) if respondidas else 0,
                }
                for o in p.opciones.all()
            ]
        elif p.tipo == Pregunta.Tipo.NUMERO:
            valores = [v for v in (_numero(t) for t in respuestas.values_list("respuesta_texto", flat=True)) if v is not None]
            dato["numeros"] = (
                {
                    "promedio": round(statistics.fmean(valores), 2),
                    "mediana": round(statistics.median(valores), 2),
                    "minimo": min(valores),
                    "maximo": max(valores),
                }
                if valores
                else None
            )
        else:
            dato["textos"] = list(
                respuestas.order_by("-cargada_en").values_list("respuesta_texto", flat=True)[:ULTIMAS_RESPUESTAS_TEXTO]
            )
        preguntas.append(dato)

    return JsonResponse({
        "cuestionario": {"id": cuestionario.pk, "titulo": cuestionario.titulo, "categoria": cuestionario.categoria.nombre},
        "total_encuestas": total,
        "ultima_encuesta": ultima.isoformat() if ultima else None,
        "militantes": cuestionario.encuestas.exclude(militante=None).values("militante").distinct().count(),
        "preguntas": preguntas,
    })
