"""La ubicación del dispositivo ya no se usa al cargar una encuesta: se quitan
de la base las restricciones que la exigían en las tablas encuestas y
respuesta_cargada (si existen)."""

from django.db import migrations

TABLAS = {
    "encuestas": "ck_encuesta_con_ubicacion",
    "respuesta_cargada": "ck_respuesta_con_ubicacion",
}


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
        migrations.RunPython(quitar, migrations.RunPython.noop),
    ]