"""encuestados ya no tiene id_grupo: quién encuestó a la persona (y con qué
rol) sale de la tabla encuestas."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0022_roles_solo_auth_group"),
    ]

    operations = [
        migrations.RemoveField(model_name="encuestado", name="grupo"),
    ]
