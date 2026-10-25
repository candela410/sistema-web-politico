from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("email", "username", "first_name", "last_name", "campana", "is_staff")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (("Campaña", {"fields": ("campana",)}),)
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "username", "password1", "password2")}),
    )
