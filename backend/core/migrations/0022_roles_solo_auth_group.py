"""Se borra la tabla grupos (y grupos_permisos): los roles quedan solo en la
tabla de Django auth_group. usuarios.id_grupo y encuestados.id_grupo pasan a
apuntar a auth_group; sus valores se traducen con grupos.id_group.
"""

import django.db.models.deletion
from django.db import migrations, models


def a_auth_group(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        # Las FK de Django son diferidas: se disparan ya para poder hacer ALTER TABLE después
        schema_editor.execute("SET CONSTRAINTS ALL IMMEDIATE")
    Grupo = apps.get_model("core", "Grupo")
    Usuario = apps.get_model("core", "Usuario")
    Encuestado = apps.get_model("core", "Encuestado")
    group_de = dict(Grupo.objects.values_list("pk", "group_id"))
    for modelo in (Usuario, Encuestado):
        for fila in modelo.objects.exclude(grupo=None):
            fila.grupo = group_de.get(fila.grupo)
            fila.save(update_fields=["grupo"])
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute("SET CONSTRAINTS ALL IMMEDIATE")


def entero(nombre):
    return migrations.AlterField(
        model_name=nombre,
        name="grupo",
        field=models.IntegerField(blank=True, null=True, db_column="id_grupo"),
    )


def fk_auth_group(nombre, related_name):
    return migrations.AlterField(
        model_name=nombre,
        name="grupo",
        field=models.ForeignKey(
            blank=True,
            db_column="id_grupo",
            null=True,
            on_delete=django.db.models.deletion.SET_NULL,
            related_name=related_name,
            to="auth.group",
        ),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("core", "0021_respuesta_sin_cargada_en"),
    ]

    operations = [
        # 1. id_grupo pasa a ser un número suelto (sin FK) para traducir los valores
        entero("usuario"),
        entero("encuestado"),
        # 2. Cada id de la tabla grupos se cambia por el id de auth_group
        migrations.RunPython(a_auth_group, migrations.RunPython.noop),
        # 3. FK a auth_group
        fk_auth_group("usuario", "usuarios"),
        fk_auth_group("encuestado", "encuestados"),
        # 4. Se borran grupos_permisos y grupos
        migrations.RemoveField(model_name="grupo", name="permisos"),
        migrations.DeleteModel(name="GrupoPermiso"),
        migrations.DeleteModel(name="Grupo"),
    ]
