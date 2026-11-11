"""Avisos de la campanita (barra superior).

"""

import re
from datetime import timedelta

from django.contrib.admin.models import LogEntry
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .api import permisos_de, requiere_permiso
from .bitacora import leer
from .models import AsignacionCuestionario

# Avisos de los últimos DIAS días, como mucho MAXIMO
DIAS = 30
MAXIMO = 20

VERBOS = {"crear": "creó", "editar": "modificó", "borrar": "borró"}

# Pantalla a la que lleva cada aviso según lo que se modificó (modelo de Django)
ENLACES = {
    "categoria": "/categorias",
    "cuestionario": "/cuestionarios",
    "encuesta": "/cuestionarios",
    "asignacioncuestionario": "/cuestionarios",
    "usuario": "/usuarios",
    "group": "/grupos",
    "equipo": "/equipos",
    "zona": "/mapa",
    "ruta": "/mapa",
    "campana": "/campanas",
}

# "Cargó una encuesta de Prioridades del barrio (documento 123)" → "Prioridades del barrio"
CUESTIONARIO_DE_ENCUESTA = re.compile(r"encuesta de (.+?) \(documento")


def _asignaciones(request, desde):
    asignaciones = (
        AsignacionCuestionario.objects.filter(
            usuario=request.user, cuestionario__activo=True, asignado_en__gte=desde
        )
        .select_related("cuestionario")
        .order_by("-asignado_en")[:MAXIMO]
    )
    return [
        {
            "id": f"asignacion-{a.cuestionario_id}",
            "tipo": "asignacion",
            "titulo": "Te asignaron un cuestionario",
            "texto": f"{a.cuestionario.titulo}: ya podés cargar encuestas.",
            "fecha": a.asignado_en.isoformat(),
            "enlace": f"/responder/{a.cuestionario_id}",
        }
        for a in asignaciones
    ]


def _actividad(request, desde):
    entradas = (
        LogEntry.objects.select_related("user", "content_type")
        .filter(action_time__gte=desde, change_message__regex=rf'"campana": {request.campana.pk}[,}}]')
        .exclude(user=request.user)
        .exclude(change_message__contains='"accion": "sesion"')
        .order_by("-action_time")[:200]
    )
    avisos = []
    encuestas = {}  # (usuario, día, cuestionario) → aviso agrupado
    for entrada in entradas:
        m = leer(entrada)
        modelo = entrada.content_type.model if entrada.content_type else ""
        quien = m["usuario"]["nombre"]

        if modelo == "encuesta" and m["accion"] == "crear":
            hallado = CUESTIONARIO_DE_ENCUESTA.search(m["detalle"])
            cuestionario = hallado.group(1) if hallado else ""
            clave = (m["usuario"]["id"], entrada.action_time.date(), cuestionario)
            if clave in encuestas:
                encuestas[clave]["cantidad"] += 1
                continue
            aviso = {
                "id": f"encuestas-{entrada.pk}",
                "tipo": "encuesta",
                "titulo": "Encuestas cargadas",
                "quien": quien,
                "cuestionario": cuestionario,
                "cantidad": 1,
                "fecha": m["fecha"],
                "enlace": ENLACES["encuesta"],
            }
            encuestas[clave] = aviso
            avisos.append(aviso)
            continue

        verbo = VERBOS.get(m["accion"], "modificó")
        seccion = m["seccion"].lower()
        texto = m["detalle"] or f"{verbo.capitalize()} {seccion} «{m['objeto']}»"
        avisos.append({
            "id": f"actividad-{entrada.pk}",
            "tipo": m["accion"],
            "titulo": f"{quien} {verbo} {seccion}".strip(),
            "texto": texto,
            "fecha": m["fecha"],
            "enlace": ENLACES.get(modelo, "/actividad"),
        })

    for a in avisos:
        if a["tipo"] == "encuesta":
            cantidad = a.pop("cantidad")
            de = f" de {a['cuestionario']}" if a["cuestionario"] else ""
            a["texto"] = f"{a.pop('quien')} cargó {'1 encuesta' if cantidad == 1 else f'{cantidad} encuestas'}{de}."
            a.pop("cuestionario")
    return avisos


@require_GET
@requiere_permiso()
def avisos(request):
    desde = timezone.now() - timedelta(days=DIAS)
    permisos = permisos_de(request.user)
    lista = []
    if "core.add_encuesta" in permisos:
        lista += _asignaciones(request, desde)
    if "admin.view_logentry" in permisos:
        lista += _actividad(request, desde)
    lista.sort(key=lambda a: a["fecha"], reverse=True)
    return JsonResponse({"avisos": lista[:MAXIMO]})