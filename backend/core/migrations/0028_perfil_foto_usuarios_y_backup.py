"""Mi perfil y Backup:
- usuarios.foto: foto de perfil (imagen chica guardada como texto).
- configuracion_backup: programación del backup automático (una sola fila).
- Nombres de usuario: se ingresa con el apellido y la primera letra del nombre
  ("perezj"), así que se reescribe usuarios.username de los usuarios que ya
  existen. Si dos personas quedan con el mismo, se numeran (perezj, perezj2).
"""

import datetime
import re
import unicodedata

from django.db import migrations, models


def _base(nombre, apellido):
    # Igual que core.models.base_username (copiada: una migración no debe
    # depender del código actual de los modelos)
    def limpio(texto):
        sin_acentos = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9]", "", sin_acentos.lower())

    nombre, apellido = limpio(nombre), limpio(apellido)
    return (apellido + nombre[:1] if apellido else nombre)[:140] or "usuario"


def nombres_de_usuario(apps, schema_editor):
    Usuario = apps.get_model("core", "Usuario")
    usuarios = list(Usuario.objects.order_by("pk").values_list("pk", "first_name", "last_name"))
    nuevos, usados = {}, set()
    for pk, nombre, apellido in usuarios:
        base = _base(nombre, apellido)
        candidato, n = base, 1
        while candidato in usados:
            n += 1
            candidato = f"{base}{n}"
        usados.add(candidato)
        nuevos[pk] = candidato
    # En dos pasos: el nombre nuevo de uno puede ser el que hoy tiene otro
    for pk in nuevos:
        Usuario.objects.filter(pk=pk).update(username=f"~{pk}")
    for pk, username in nuevos.items():
        Usuario.objects.filter(pk=pk).update(username=username)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0027_sin_ubicacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="foto",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="ConfiguracionBackup",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("activo", models.BooleanField(default=False)),
                (
                    "frecuencia",
                    models.CharField(
                        choices=[
                            ("diaria", "Todos los días"),
                            ("semanal", "Una vez por semana"),
                        ],
                        default="diaria",
                        max_length=10,
                    ),
                ),
                ("dia_semana", models.PositiveSmallIntegerField(default=0)),
                ("hora", models.TimeField(default=datetime.time(3, 0))),
                ("controlado_hasta", models.DateTimeField(blank=True, null=True)),
                ("ultimo_automatico", models.DateTimeField(blank=True, null=True)),
                ("ultimo_error", models.TextField(blank=True, default="")),
            ],
            options={
                "verbose_name": "configuración de backup",
                "db_table": "configuracion_backup",
                "default_permissions": (),
                "constraints": [
                    models.CheckConstraint(
                        condition=models.Q(("dia_semana__lte", 6)),
                        name="ck_backup_dia_semana",
                    )
                ],
            },
        ),
        # Al deshacer la migración los nombres de usuario quedan como están
        migrations.RunPython(nombres_de_usuario, migrations.RunPython.noop),
    ]
