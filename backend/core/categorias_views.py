"""API de categorías de cuestionarios: listar, crear, editar, activar o
desactivar y borrar. Al desactivar una categoría se desactivan todos sus
cuestionarios."""

from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, registrar
from .models import Categoria, Cuestionario
from .validaciones import nombre_cosa


def _categoria_json(categoria):
    # En el listado la cantidad viene anotada; al crear o editar se cuenta
    cantidad = getattr(categoria, "cantidad_cuestionarios", None)
    if cantidad is None:
        cantidad = categoria.cuestionarios.count()
    return {
        "id": categoria.pk,
        "nombre": categoria.nombre,
        "descripcion": categoria.descripcion or "",
        "activa": categoria.activa,
        "cuestionarios": cantidad,
    }


def _foto(c):
    return {"Nombre": c.nombre, "Descripción": c.descripcion or "", "Activa": "Sí" if c.activa else "No"}


def _validar(datos, categoria=None):
    nombre = datos.get("nombre")
    if not isinstance(nombre, str) or not nombre.strip():
        return "Ingrese el nombre de la categoría."
    if len(nombre.strip()) > 120:
        return "El nombre admite hasta 120 caracteres."
    mensaje = nombre_cosa(nombre.strip())
    if mensaje:
        return mensaje
    descripcion = datos.get("descripcion")
    if descripcion is not None and not isinstance(descripcion, str):
        return "La descripción no es válida."
    if not isinstance(datos.get("activa", True), bool):
        return "El estado no es válido."
    repetida = Categoria.objects.filter(nombre__iexact=nombre.strip())
    if categoria:
        repetida = repetida.exclude(pk=categoria.pk)
    if repetida.exists():
        return "Ya existe una categoría con ese nombre."
    return None


@require_http_methods(["GET", "POST"])
@requiere_permiso(crud("categoria"))
def categorias(request):
    if request.method == "GET":
        lista = Categoria.objects.annotate(cantidad_cuestionarios=Count("cuestionarios")).order_by("nombre")
        return JsonResponse({"categorias": [_categoria_json(c) for c in lista]})

    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    mensaje = _validar(datos)
    if mensaje:
        return error(mensaje)
    categoria = Categoria.objects.create(
        nombre=datos["nombre"].strip(),
        descripcion=(datos.get("descripcion") or "").strip() or None,
        activa=datos.get("activa", True),
    )
    registrar(request, categoria, "crear", detalle=f"Creó la categoría {categoria.nombre}")
    return JsonResponse({"categoria": _categoria_json(categoria)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
@requiere_permiso(crud("categoria"))
def categoria_detalle(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk)

    if request.method == "DELETE":
        cantidad = categoria.cuestionarios.count()
        if cantidad:
            return error(
                f"No se puede eliminar la categoría porque tiene {cantidad} cuestionario{'s' if cantidad != 1 else ''}.",
                409,
            )
        categoria.delete()
        registrar(request, categoria, "borrar", detalle=f"Borró la categoría {categoria.nombre}")
        return JsonResponse({"ok": True})

    datos = leer_json(request)
    if datos is None:
        return error("Los datos enviados no son válidos.")
    datos.setdefault("nombre", categoria.nombre)
    mensaje = _validar(datos, categoria)
    if mensaje:
        return error(mensaje)
    antes = _foto(categoria)
    desactivados = 0
    with transaction.atomic():
        categoria.nombre = datos["nombre"].strip()
        if "descripcion" in datos:
            categoria.descripcion = (datos["descripcion"] or "").strip() or None
        se_desactiva = categoria.activa and datos.get("activa") is False
        if "activa" in datos:
            categoria.activa = datos["activa"]
        categoria.save()
        # Desactivar la categoría desactiva todos sus cuestionarios (al volver a
        # activarla, los cuestionarios se activan uno por uno)
        if se_desactiva:
            desactivados = Cuestionario.objects.filter(categoria=categoria, activo=True).update(activo=False)
    cambios = diferencias(antes, _foto(categoria))
    if cambios:
        detalle = f"Desactivó {desactivados} cuestionario(s) de la categoría" if desactivados else ""
        registrar(request, categoria, "editar", cambios=cambios, detalle=detalle)
    return JsonResponse({"categoria": _categoria_json(categoria), "cuestionarios_desactivados": desactivados})
