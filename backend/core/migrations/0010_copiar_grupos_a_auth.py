"""Pasa los grupos de la tabla propia (core.Grupo) a grupos de Django (auth.Group).

Gestión → Usuarios asigna grupos de Django, así que los grupos que se crearon
en Gestión → Grupos tienen que existir ahí. Por cada grupo propio se crea (o se
reutiliza, si ya hay uno con ese nombre) el grupo de Django, se le copian los
permisos y se enlaza la ficha. No se borra nada.
"""

from django.db import migrations


def copiar(apps, schema_editor):
    Grupo = apps.get_model("core", "Grupo")
    Group = apps.get_model("auth", "Group")

    for grupo in Grupo.objects.filter(group__isnull=True):
        group, creado = Group.objects.get_or_create(name=grupo.nombre)
        # Si el grupo de Django ya existía, se suman los permisos sin quitar los suyos
        group.permissions.add(*grupo.permisos.all())
        grupo.group = group
        grupo.save(update_fields=["group"])

    # Los grupos de Django que no tenían ficha (por ejemplo "Militantes")
    # reciben una vacía, para que la pantalla Grupos pueda guardar su descripción
    for group in Group.objects.filter(ficha__isnull=True):
        Grupo.objects.get_or_create(nombre=group.name[:120], defaults={"group": group})


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0009_grupo_ficha_de_group"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunPython(copiar, migrations.RunPython.noop)]