"""Grupos de Django con los permisos de cada rol.

- Administración de campaña: gestiona todo lo de su campaña, ve los permisos
  y el historial, pero no administra campañas ni elige otra campaña.
- Militantes: solo cargan encuestas de su campaña.
El superusuario tiene todos los permisos sin necesidad de grupo.
"""

from django.contrib.auth.management import create_permissions
from django.db import migrations

ADMINISTRACION = "Administración de campaña"
MILITANTES = "Militantes"
# Las campañas las administra el superusuario (o quien reciba esos permisos)
SIN_ADMINISTRACION = {"view_campana", "add_campana", "change_campana", "delete_campana", "elegir_campana"}


def crear_grupos(apps, schema_editor):
    # Los permisos se crean al final de migrate; acá se crean antes para poder asignarlos
    for app_config in apps.get_app_configs():
        app_config.models_module = True
        create_permissions(app_config, apps=apps, verbosity=0)
        app_config.models_module = None

    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")

    administracion, _ = Group.objects.get_or_create(name=ADMINISTRACION)
    permisos = Permission.objects.filter(content_type__app_label="core").exclude(codename__in=SIN_ADMINISTRACION)
    extra = Permission.objects.filter(
        content_type__app_label__in=["auth", "admin"],
        codename__in=["view_group", "view_permission", "view_logentry"],
    )
    administracion.permissions.set(list(permisos) + list(extra))

    militantes, _ = Group.objects.get_or_create(name=MILITANTES)
    militantes.permissions.set(
        Permission.objects.filter(content_type__app_label="core", codename__in=["add_encuesta"])
    )


def borrar_grupos(apps, schema_editor):
    apps.get_model("auth", "Group").objects.filter(name__in=[ADMINISTRACION, MILITANTES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_campanas_y_zonas"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("admin", "0003_logentry_add_action_flag_choices"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [migrations.RunPython(crear_grupos, borrar_grupos)]
