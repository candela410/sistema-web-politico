from django.urls import path

from . import mapa_views, views

urlpatterns = [
    path("auth/csrf/", views.csrf, name="auth-csrf"),
    path("auth/login/", views.login_view, name="auth-login"),
    path("auth/logout/", views.logout_view, name="auth-logout"),
    path("auth/me/", views.me, name="auth-me"),
    path("mapa/barrios/", mapa_views.barrios, name="mapa-barrios"),
    path("mapa/calles/", mapa_views.calles, name="mapa-calles"),
    path("mapa/zonas/", mapa_views.zonas, name="mapa-zonas"),
    path("mapa/zonas/<int:pk>/", mapa_views.zona_detalle, name="mapa-zona"),
    path("mapa/rutas/", mapa_views.rutas, name="mapa-rutas"),
    path("mapa/rutas/<int:pk>/", mapa_views.ruta_detalle, name="mapa-ruta"),
]
