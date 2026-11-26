"""Permisos de los usuarios a partir de su rol.

El usuario tiene un solo rol: usuarios.id_grupo (FK a auth_group). Sus
permisos son los de ese grupo (auth_group_permissions). No hay permisos
sueltos por usuario ni tabla usuarios_groups.
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import Permission


class GrupoBackend(ModelBackend):
    def _get_user_permissions(self, user_obj):
        return Permission.objects.none()

    def _get_group_permissions(self, user_obj):
        if not user_obj.grupo_id:
            return Permission.objects.none()
        return Permission.objects.filter(group=user_obj.grupo_id)

    def with_perm(self, perm, is_active=True, include_superusers=True, obj=None):
        raise NotImplementedError("No se usa en el sistema")
