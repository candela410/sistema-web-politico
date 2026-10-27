"""Grupo "Militantes" (tabla auth_group) con su permiso (auth_group_permissions).

La administración de una campaña no es un grupo: es el permiso propio
"administrar_campana" (auth_permission), que se le da a cada usuario o a un
grupo desde Gestión → Usuarios o desde el admin de Django.
El superusuario tiene todos los permisos.
"""

from django.contrib.auth.management import create_permissions
from django.db import migrations

MILITANTES = "Militantes"


def crear_grupo(apps, schema_editor):
    # Los permisos se crean al final de migrate; acá se crean antes para poder asignarlos
    for app_config in apps.get_app_configs():
        app_config.models_module = True
        create_permissions(app_config, apps=apps, verbosity=0)
        app_config.models_module = None

    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    militantes, _ = Group.objects.get_or_create(name=MILITANTES)
    militantes.permissions.set(
        Permission.objects.filter(content_type__app_label="core", codename__in=["add_encuesta"])
    )


def borrar_grupo(apps, schema_editor):
    apps.get_model("auth", "Group").objects.filter(name=MILITANTES).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0004_campanas_y_barrios"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [migrations.RunPython(crear_grupo, borrar_grupo)]
