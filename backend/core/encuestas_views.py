"""Carga de encuestas (vista del militante) y estadísticas por pregunta
(vista de la administración)."""

import statistics
from collections import Counter
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import error, leer_json, requiere_permiso
from .bitacora import registrar
from .models import Barrio, Cuestionario, Encuesta, Encuestado, Pregunta, RespuestaCargada, numero_de



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
@requiere_permiso("core.add_encuesta")
def cuestionarios_para_responder(request):
    lista = Cuestionario.objects.filter(activo=True, campana=request.campana).select_related("categoria").order_by("titulo")
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
        limpias += [RespuestaCargada(pregunta=pregunta, opcion_id=o) for o in elegidas]
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
    cuestionario = get_object_or_404(
        Cuestionario.objects.select_related("categoria"), pk=pk, activo=True, campana=request.campana
    )
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
    registrar(
        request, encuesta, "crear",
        detalle=f"Cargó una encuesta de {cuestionario.titulo} (documento {encuestado.documento})",
    )
    return JsonResponse({"ok": True, "encuesta": encuesta.pk}, status=201)


# ---------------------------------------------------------------------------
# Estadísticas
# ---------------------------------------------------------------------------


def _medidas(valores):
    """Medidas de una variable cuantitativa (una lista con un valor por respuesta)."""
    if not valores:
        return None
    frecuencias = Counter(valores)
    maximo = max(frecuencias.values())
    return {
        "n": len(valores),
        "media": round(statistics.fmean(valores), 2),
        "mediana": round(statistics.median(valores), 2),
        # Puede haber más de una moda; si ningún valor se repite, no hay moda
        "moda": [] if maximo == 1 and len(frecuencias) > 1 else sorted(v for v, f in frecuencias.items() if f == maximo),
        "desvio": round(statistics.stdev(valores), 2) if len(valores) > 1 else 0,
        "minimo": min(valores),
        "maximo": max(valores),
        "rango": max(valores) - min(valores),
    }


@require_http_methods(["GET"])
@requiere_permiso("core.view_cuestionario", "core.view_encuesta")
def estadisticas(request, pk):
    cuestionario = get_object_or_404(Cuestionario.objects.select_related("categoria"), pk=pk, campana=request.campana)
    total = cuestionario.encuestas.count()
    ultima = cuestionario.encuestas.order_by("-realizada_en").values_list("realizada_en", flat=True).first()

    preguntas = []
    for p in cuestionario.preguntas.prefetch_related("opciones"):
        opciones = list(p.opciones.all())
        variable = Pregunta.variable_de(o.texto for o in opciones)
        filas = RespuestaCargada.objects.filter(pregunta=p)
        conteo = Counter(filas.values_list("opcion_id", flat=True))
        # Personas que respondieron (en opción múltiple una persona elige varias)
        respondidas = filas.values("encuesta").distinct().count()

        lista = [
            {
                "id": o.pk,
                "texto": o.texto,
                "cantidad": conteo.get(o.pk, 0),
                "porcentaje": round(100 * conteo.get(o.pk, 0) / respondidas, 1) if respondidas else 0,
            }
            for o in opciones
        ]
        dato = {
            "id": p.pk,
            "enunciado": p.enunciado,
            "tipo": p.tipo,
            "variable": variable,
            "obligatoria": p.obligatoria,
            "respondidas": respondidas,
            "sin_responder": total - respondidas,
            "elecciones": sum(conteo.values()),
        }
        if variable == Pregunta.Variable.CUANTITATIVA:
            for o in lista:
                o["valor"] = numero_de(o["texto"])
            lista.sort(key=lambda o: o["valor"])  # eje ordenado de menor a mayor
            dato["medidas"] = _medidas([o["valor"] for o in lista for _ in range(o["cantidad"])])
        dato["opciones"] = lista
        preguntas.append(dato)

    return JsonResponse({
        "cuestionario": {"id": cuestionario.pk, "titulo": cuestionario.titulo, "categoria": cuestionario.categoria.nombre},
        "total_encuestas": total,
        "ultima_encuesta": ultima.isoformat() if ultima else None,
        "militantes": cuestionario.encuestas.exclude(militante=None).values("militante").distinct().count(),
        "preguntas": preguntas,
    })
