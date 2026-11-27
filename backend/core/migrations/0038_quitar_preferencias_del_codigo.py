"""Se quita del código la configuración de preferencias de notificaciones.

Solo cambia el estado de Django (deja de conocer el modelo
PreferenciaNotificacion). NO toca la base: la tabla preferencias_notificaciones
sigue en Neon tal cual. Borrarla sería otro paso, con autorización.
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0037_fk_duplicadas_notificaciones"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[migrations.DeleteModel(name="PreferenciaNotificacion")],
            database_operations=[],
        ),
    ]
