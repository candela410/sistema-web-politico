"""Corrige los nombres cargados antes de la regla de mayúsculas:
personas (usuarios y encuestados) con mayúscula en cada palabra; nombres de
cosas y títulos de cuestionarios con la primera letra en mayúscula."""

from django.db import migrations

from core.models import con_mayuscula, nombre_propio

PERSONAS = {"Usuario": ("first_name", "last_name"), "Encuestado": ("nombre", "apellido")}
COSAS = {
    "Campana": ("nombre",), "Categoria": ("nombre",), "Equipo": ("nombre",), "Ruta": ("nombre",),
    "Zona": ("nombre",), "Barrio": ("nombre",), "Calle": ("nombre",), "Cuestionario": ("titulo",),
}


def corregir(apps, schema_editor):
    for modelos, regla in ((PERSONAS, nombre_propio), (COSAS, con_mayuscula)):
        for nombre, campos in modelos.items():
            Modelo = apps.get_model("core", nombre)
            for fila in Modelo.objects.all().only("pk", *campos):
                cambios = {c: regla(getattr(fila, c)) for c in campos if getattr(fila, c) != regla(getattr(fila, c))}
                if cambios:
                    Modelo.objects.filter(pk=fila.pk).update(**cambios)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0034_notificaciones"),
    ]

    operations = [
        migrations.RunPython(corregir, migrations.RunPython.noop),
    ]
