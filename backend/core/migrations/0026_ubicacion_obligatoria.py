"""La ubicación del dispositivo es obligatoria al cargar una encuesta, en la
tabla encuestas y en respuesta_cargada.

Las filas anteriores sin ubicación se conservan: las restricciones se crean
NOT VALID (Postgres), así se exigen en cada fila nueva o modificada pero no
se revisan las que ya estaban. Además lo valida la vista (encuestas_views)."""

from django.db import migrations

TABLAS = {
    "encuestas": "ck_encuesta_con_ubicacion",
    "respuesta_cargada": "ck_respuesta_con_ubicacion",
}


def crear(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for tabla, nombre in TABLAS.items():
            cursor.execute(
                f"ALTER TABLE {tabla} ADD CONSTRAINT {nombre} "
                "CHECK (latitud IS NOT NULL AND longitud IS NOT NULL) NOT VALID"
            )


def quitar(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for tabla, nombre in TABLAS.items():
            cursor.execute(f"ALTER TABLE {tabla} DROP CONSTRAINT IF EXISTS {nombre}")


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0025_zonas_de_barrios_y_permisos_sin_id"),
    ]

    operations = [
        migrations.RunPython(crear, quitar),
    ]
