"""Une las dos ramas de migraciones: la de campañas (0004_campanas_y_barrios,
0005_grupos) y la de grupos (0004_grupo, 0006_grupos_descripcion_permisos).
No cambia nada en la base."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_grupos"),
        ("core", "0006_grupos_descripcion_permisos"),
    ]

    operations = []
