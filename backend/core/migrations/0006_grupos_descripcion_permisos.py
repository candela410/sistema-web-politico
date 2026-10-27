from django.db import migrations, models


def agregar_geometria_aproximada(apps, schema_editor):
    Barrio = apps.get_model("core", "Barrio")
    conexion = schema_editor.connection
    with conexion.cursor() as cursor:
        columnas = [
            c.name
            for c in conexion.introspection.get_table_description(cursor, Barrio._meta.db_table)
        ]
    if "geometria_aproximada" in columnas:
        return
    campo = models.BooleanField(default=False)
    campo.set_attributes_from_name("geometria_aproximada")
    schema_editor.add_field(Barrio, campo)


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("core", "0004_grupo"),
        # Después de la de campañas, que también agrega geometria_aproximada:
        # así en una base nueva (tests) la columna se crea una sola vez
        ("core", "0004_campanas_y_barrios"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="asignacioncuestionario",
            options={"verbose_name": "asignación de cuestionario"},
        ),
        migrations.AlterModelOptions(
            name="barrio",
            options={"ordering": ["nombre"], "verbose_name": "barrio"},
        ),
        migrations.AlterModelOptions(
            name="calle",
            options={"ordering": ["nombre"], "verbose_name": "calle"},
        ),
        migrations.AlterModelOptions(
            name="campana",
            options={
                "ordering": ["-activa", "nombre"],
                "permissions": [
                    ("elegir_campana", "Puede elegir la campaña al ingresar"),
                    ("administrar_campana", "Puede administrar la campaña"),
                ],
                "verbose_name": "campaña",
                "verbose_name_plural": "campañas",
            },
        ),
        migrations.AlterModelOptions(
            name="categoria",
            options={"ordering": ["nombre"], "verbose_name": "categoría"},
        ),
        migrations.AlterModelOptions(
            name="cuestionario",
            options={"verbose_name": "cuestionario"},
        ),
        migrations.AlterModelOptions(
            name="encuesta",
            options={"verbose_name": "encuesta"},
        ),
        migrations.AlterModelOptions(
            name="encuestado",
            options={"verbose_name": "encuestado"},
        ),
        migrations.AlterModelOptions(
            name="equipo",
            options={"verbose_name": "equipo"},
        ),
        migrations.AlterModelOptions(
            name="grupo",
            options={"ordering": ["nombre"], "verbose_name": "grupo"},
        ),
        migrations.AlterModelOptions(
            name="militante",
            options={"ordering": ["apellido", "nombre"], "verbose_name": "militante"},
        ),
        migrations.AlterModelOptions(
            name="opcion",
            options={
                "ordering": ["orden"],
                "verbose_name": "opción",
                "verbose_name_plural": "opciones",
            },
        ),
        migrations.AlterModelOptions(
            name="pregunta",
            options={"ordering": ["orden"], "verbose_name": "pregunta"},
        ),
        migrations.AlterModelOptions(
            name="ruta",
            options={"verbose_name": "ruta"},
        ),
        migrations.AlterModelOptions(
            name="usuario",
            options={"verbose_name": "usuario"},
        ),
        migrations.AlterModelOptions(
            name="zona",
            options={"ordering": ["nombre"], "verbose_name": "zona"},
        ),
        # La columna puede existir ya en la base (se creó antes que la migración):
        # solo se agrega si falta, y siempre se registra en el estado de Django.
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="barrio",
                    name="geometria_aproximada",
                    field=models.BooleanField(default=False),
                ),
            ],
            database_operations=[
                migrations.RunPython(agregar_geometria_aproximada, migrations.RunPython.noop),
            ],
        ),
        migrations.AddField(
            model_name="grupo",
            name="descripcion",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="grupo",
            name="permisos",
            field=models.ManyToManyField(
                blank=True,
                db_table="grupos_permisos",
                related_name="grupos_core",
                to="auth.permission",
            ),
        ),
    ]