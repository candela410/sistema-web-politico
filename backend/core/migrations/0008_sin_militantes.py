"""Se quita la tabla militantes: sus datos pasan a la tabla usuarios.

- usuarios gana documento, telefono, direccion e id_equipo.
- encuestas.id_militante pasa a encuestas.id_usuario (quién cargó la encuesta).
- militantexcuestionarios pasa a usuariosxcuestionarios (id_usuario).
Los datos existentes se copian antes de borrar la tabla militantes.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def pasar_datos(apps, schema_editor):
    Militante = apps.get_model("core", "Militante")
    Usuario = apps.get_model("core", "Usuario")
    Encuesta = apps.get_model("core", "Encuesta")
    Asignacion = apps.get_model("core", "AsignacionCuestionario")

    for m in Militante.objects.exclude(usuario=None):
        u = Usuario.objects.get(pk=m.usuario_id)
        u.documento = u.documento or m.documento
        u.telefono = u.telefono or m.telefono
        u.direccion = u.direccion or m.direccion
        u.equipo_id = u.equipo_id or m.equipo_id
        if not u.first_name:
            u.first_name = m.nombre
        if not u.last_name:
            u.last_name = m.apellido
        u.save()

    usuario_de = dict(Militante.objects.exclude(usuario=None).values_list("pk", "usuario_id"))
    for e in Encuesta.objects.exclude(militante=None):
        e.usuario_id = usuario_de.get(e.militante_id)
        e.save(update_fields=["usuario"])
    for a in Asignacion.objects.all():
        if a.militante_id in usuario_de:
            a.usuario_id = usuario_de[a.militante_id]
            a.save(update_fields=["usuario"])
        else:
            # Militante sin usuario: la asignación no tiene a quién pasar
            a.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_merge_grupos_campanas"),
    ]

    operations = [
        # 1. Datos de la persona en usuarios
        migrations.AddField(
            model_name="usuario",
            name="documento",
            field=models.CharField(blank=True, max_length=30, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="usuario",
            name="telefono",
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
        migrations.AddField(
            model_name="usuario",
            name="direccion",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="usuario",
            name="equipo",
            field=models.ForeignKey(
                blank=True,
                db_column="id_equipo",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="usuarios",
                to="core.equipo",
            ),
        ),
        # 2. Columnas nuevas que apuntan a usuarios
        migrations.AddField(
            model_name="encuesta",
            name="usuario",
            field=models.ForeignKey(
                blank=True,
                db_column="id_usuario",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="encuestas_cargadas",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="asignacioncuestionario",
            name="usuario",
            field=models.ForeignKey(
                db_column="id_usuario",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # 3. Copia de datos
        migrations.RunPython(pasar_datos, migrations.RunPython.noop),
        # 4. Se quitan las referencias a militantes
        migrations.RemoveConstraint(model_name="asignacioncuestionario", name="uq_militante_cuestionario"),
        migrations.RemoveField(model_name="cuestionario", name="militantes"),
        migrations.RemoveField(model_name="asignacioncuestionario", name="militante"),
        migrations.RemoveField(model_name="encuesta", name="militante"),
        migrations.AlterField(
            model_name="asignacioncuestionario",
            name="usuario",
            field=models.ForeignKey(
                db_column="id_usuario",
                on_delete=django.db.models.deletion.PROTECT,
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name="asignacioncuestionario",
            constraint=models.UniqueConstraint(fields=("usuario", "cuestionario"), name="uq_usuario_cuestionario"),
        ),
        migrations.AlterModelTable(name="asignacioncuestionario", table="usuariosxcuestionarios"),
        migrations.AddField(
            model_name="cuestionario",
            name="usuarios",
            field=models.ManyToManyField(
                related_name="cuestionarios_asignados",
                through="core.AsignacionCuestionario",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # 5. Adiós tabla militantes
        migrations.DeleteModel(name="Militante"),
    ]
