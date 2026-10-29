from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("email", "username", "first_name", "last_name", "campana", "is_staff")
    ordering = ("email",)
    search_fields = ("email", "first_name", "last_name", "documento")
    fieldsets = UserAdmin.fieldsets + (
        ("Campaña", {"fields": ("campana", "equipo")}),
        ("Datos de la persona", {"fields": ("documento", "telefono", "direccion")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),
    )

