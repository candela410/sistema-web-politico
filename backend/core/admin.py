from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Militante, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("email", "username", "first_name", "last_name", "campana", "is_staff")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (("Campaña", {"fields": ("campana",)}),)
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),
    )


@admin.register(Militante)
class MilitanteAdmin(admin.ModelAdmin):
    list_display = ("apellido", "nombre", "documento", "usuario", "equipo", "activo")
    search_fields = ("apellido", "nombre", "documento")
    list_filter = ("activo",)
    autocomplete_fields = ("usuario",)
