from django.urls import path

from . import (
    campanas_views,
    categorias_views,
    cuestionarios_views,
    encuestas_views,
    mapa_views,
    usuarios_views,
    views,
)

urlpatterns = [
    path("auth/csrf/", views.csrf, name="auth-csrf"),
    path("auth/login/", views.login_view, name="auth-login"),
    path("auth/logout/", views.logout_view, name="auth-logout"),
    path("auth/me/", views.me, name="auth-me"),
    path("campanas/", campanas_views.campanas, name="campanas"),
    path("campanas/disponibles/", campanas_views.disponibles, name="campanas-disponibles"),
    path("campanas/activa/", campanas_views.activa, name="campana-activa"),
    path("campanas/<int:pk>/", campanas_views.campana_detalle, name="campana"),
    path("usuarios/", usuarios_views.usuarios, name="usuarios"),
    path("usuarios/<int:pk>/", usuarios_views.usuario_detalle, name="usuario"),
    path("permisos/", usuarios_views.permisos, name="permisos"),
    path("historial/", usuarios_views.historial, name="historial"),
    path("categorias/", categorias_views.categorias, name="categorias"),
    path("categorias/<int:pk>/", categorias_views.categoria_detalle, name="categoria"),
    path("cuestionarios/", cuestionarios_views.cuestionarios, name="cuestionarios"),
    path("cuestionarios/<int:pk>/", cuestionarios_views.cuestionario_detalle, name="cuestionario"),
    path("cuestionarios/<int:pk>/estadisticas/", encuestas_views.estadisticas, name="cuestionario-estadisticas"),
    path("responder/", encuestas_views.cuestionarios_para_responder, name="responder-lista"),
    path("responder/<int:pk>/", encuestas_views.responder, name="responder"),
    path("mapa/barrios/", mapa_views.barrios, name="mapa-barrios"),
    path("mapa/calles/", mapa_views.calles, name="mapa-calles"),
    path("mapa/zonas/", mapa_views.zonas, name="mapa-zonas"),
    path("mapa/zonas/<int:pk>/", mapa_views.zona_detalle, name="mapa-zona"),
    path("mapa/rutas/", mapa_views.rutas, name="mapa-rutas"),
    path("mapa/rutas/<int:pk>/", mapa_views.ruta_detalle, name="mapa-ruta"),
]
