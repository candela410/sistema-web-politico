
from django.urls import path

from . import (
    categorias_views,
    cuestionarios_views,
    encuestas_views,
    grupos_views,
    mapa_views,
    permisos_views,
    views,
)

urlpatterns = [
    path("auth/csrf/", views.csrf, name="auth-csrf"),
    path("auth/login/", views.login_view, name="auth-login"),
    path("auth/logout/", views.logout_view, name="auth-logout"),
    path("auth/me/", views.me, name="auth-me"),

    path("categorias/", categorias_views.categorias, name="categorias"),
    path(
        "categorias/<int:pk>/",
        categorias_views.categoria_detalle,
        name="categoria",
    ),

    path("grupos/", grupos_views.grupos, name="grupos"),
    path(
        "grupos/<int:pk>/",
        grupos_views.grupo_detalle,
        name="grupo",
    ),
    path("permisos/", permisos_views.permisos, name="permisos"),

    path("cuestionarios/", cuestionarios_views.cuestionarios, name="cuestionarios"),
    path(
        "cuestionarios/<int:pk>/",
        cuestionarios_views.cuestionario_detalle,
        name="cuestionario",
    ),
    
    path(
        "cuestionarios/<int:pk>/estadisticas/",
        encuestas_views.estadisticas,
        name="cuestionario-estadisticas",
    ),
    path("responder/", encuestas_views.cuestionarios_para_responder, name="responder-lista"),
    path("responder/<int:pk>/", encuestas_views.responder, name="responder"),

    path("mapa/barrios/", mapa_views.barrios, name="mapa-barrios"),
    path("mapa/calles/", mapa_views.calles, name="mapa-calles"),
    path("mapa/zonas/", mapa_views.zonas, name="mapa-zonas"),
    path("mapa/zonas/<int:pk>/", mapa_views.zona_detalle, name="mapa-zona"),
    path("mapa/rutas/", mapa_views.rutas, name="mapa-rutas"),
    path("mapa/rutas/<int:pk>/", mapa_views.ruta_detalle, name="mapa-ruta"),
]
