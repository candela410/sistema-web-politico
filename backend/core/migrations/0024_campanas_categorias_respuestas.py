"""- campanas: se borran fecha_inicio y fecha_fin (lo que vale es "activa").
- categorias: nuevo campo activa (al desactivarla se desactivan sus cuestionarios).
- respuesta_cargada: latitud y longitud del celular al cargar la respuesta
  (para saber en qué zona se respondió). Las respuestas anteriores quedan vacías.
- Se quitan los permisos propios "administrar_campana" y "elegir_campana":
  los permisos salen solo de los roles. Quien tenía "administrar_campana" pasa
  al rol "Administración" (con los mismos permisos que le daba) y quien tenía
  "elegir_campana" recibe "Ver campañas", que ahora es lo que permite elegirla.
"""

from django.db import migrations, models

# Lo que NO incluía "administrar_campana"
NO_INCLUIDOS = {"view_campana", "add_campana", "change_campana", "delete_campana", "elegir_campana", "administrar_campana"}


def quitar_permisos_propios(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    Group = apps.get_model("auth", "Group")
    Usuario = apps.get_model("core", "Usuario")
    propios = Permission.objects.filter(content_type__app_label="core")

    administrar = propios.filter(codename="administrar_campana").first()
    if administrar:
        usuarios = list(Usuario.objects.filter(user_permissions=administrar))
        grupos = list(Group.objects.filter(permissions=administrar))
        if usuarios or grupos:
            incluidos = list(propios.exclude(codename__in=NO_INCLUIDOS)) + list(
                Permission.objects.filter(
                    content_type__app_label__in=["auth", "admin"],
                    codename__in=["view_group", "view_permission", "view_logentry"],
                )
            )
            administracion, _ = Group.objects.get_or_create(name="Administración")
            administracion.permissions.add(*incluidos)
            for grupo in grupos:
                grupo.permissions.add(*incluidos)
            for usuario in usuarios:
                usuario.groups.set([administracion])
                usuario.grupo_id = administracion.pk
                usuario.save(update_fields=["grupo"])

    elegir = propios.filter(codename="elegir_campana").first()
    ver = propios.filter(codename="view_campana").first()
    if elegir and ver:
        for usuario in Usuario.objects.filter(user_permissions=elegir):
            usuario.user_permissions.add(ver)
        for grupo in Group.objects.filter(permissions=elegir):
            grupo.permissions.add(ver)

    propios.filter(codename__in=["administrar_campana", "elegir_campana"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("core", "0023_encuestado_sin_grupo"),
    ]

    operations = [
        migrations.RunPython(quitar_permisos_propios, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name="campana",
            options={
                "ordering": ["-activa", "nombre"],
                "verbose_name": "campaña",
                "verbose_name_plural": "campañas",
            },
        ),
        migrations.RemoveConstraint(
            model_name="campana",
            name="ck_campana_fechas",
        ),
        migrations.RemoveField(
            model_name="campana",
            name="fecha_inicio",
        ),
        migrations.RemoveField(
            model_name="campana",
            name="fecha_fin",
        ),
        migrations.AddField(
            model_name="categoria",
            name="activa",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="respuestacargada",
            name="latitud",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="respuestacargada",
            name="longitud",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
    ]
