"""API de categorías de cuestionarios: listar, crear, editar y borrar."""

from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .api import crud, error, leer_json, requiere_permiso
from .bitacora import diferencias, registrar
from .models import Categoria


def _categoria_json(categoria):
    # En el listado la cantidad viene anotada; al crear o editar se cuenta
    cantidad = getattr(categoria, "cantidad_cuestionarios", None)
    if cantidad is None:
        cantidad = categoria.cuestionarios.count()
    return {
        "id": categoria.pk,
        "nombre": categoria.nombre,
        "descripcion": categoria.descripcion or "",
        "cuestionarios": cantidad,
    }


def _foto(c):
    return {"Nombre": c.nombre, "Descripción": c.descripcion or ""}


def _validar(datos, categoria=None):
    nombre = datos.get("nombre")
    if not isinstance(nombre, str) or not nombre.strip():
        return "Poné un nombre a la categoría."
    if len(nombre.strip()) > 120:
        return "El nombre es muy largo (máximo 120 caracteres)."
    descripcion = datos.get("descripcion")
    if descripcion is not None and not isinstance(descripcion, str):
        return "La descripción debe ser texto."
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
        return error("JSON inválido.")
    mensaje = _validar(datos)
    if mensaje:
        return error(mensaje)
    categoria = Categoria.objects.create(
        nombre=datos["nombre"].strip(),
        descripcion=(datos.get("descripcion") or "").strip() or None,
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
                f"No se puede borrar: la usan {cantidad} cuestionario(s). Cambiales la categoría primero.",
                409,
            )
        categoria.delete()
        registrar(request, categoria, "borrar", detalle=f"Borró la categoría {categoria.nombre}")
        return JsonResponse({"ok": True})

    datos = leer_json(request)
    if datos is None:
        return error("JSON inválido.")
    datos.setdefault("nombre", categoria.nombre)
    mensaje = _validar(datos, categoria)
    if mensaje:
        return error(mensaje)
    antes = _foto(categoria)
    categoria.nombre = datos["nombre"].strip()
    if "descripcion" in datos:
        categoria.descripcion = (datos["descripcion"] or "").strip() or None
    categoria.save()
    cambios = diferencias(antes, _foto(categoria))
    if cambios:
        registrar(request, categoria, "editar", cambios=cambios)
    return JsonResponse({"categoria": _categoria_json(categoria)})
