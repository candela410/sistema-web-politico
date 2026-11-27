"""Se quitan las notificaciones del sistema (pedido del usuario):

- borra la tabla preferencias_notificaciones (vacía; el código ya no la usaba
  desde la 0038),
- borra la tabla notificaciones (modelo Notificacion) y
- borra sus permisos "Recibir aviso de ..." (y su content type), que quedaban
  sin uso en la pantalla de permisos. auth_group_permissions los suelta solo
  (ON DELETE CASCADE).

No se puede deshacer.
"""

from django.db import migrations


def borrar_permisos(apps, schema_editor):
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    tipos = ContentType.objects.filter(app_label="core", model="notificacion")
    Permission.objects.filter(content_type__in=tipos).delete()
    tipos.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0038_quitar_preferencias_del_codigo"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunSQL(
            "DROP TABLE IF EXISTS preferencias_notificaciones;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.DeleteModel(name="Notificacion"),
        migrations.RunPython(borrar_permisos, migrations.RunPython.noop),
    ]
