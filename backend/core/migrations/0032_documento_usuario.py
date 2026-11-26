"""La columna que guarda el documento del usuario pasa a llamarse
documento_usuario en usuariosxcuestionarios y en encuestas (antes id_usuario).
Postgres mantiene la PK compuesta y las FK al renombrar."""

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0031_documento_pk_de_usuarios"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    [
                        "ALTER TABLE usuariosxcuestionarios RENAME COLUMN id_usuario TO documento_usuario",
                        "ALTER TABLE encuestas RENAME COLUMN id_usuario TO documento_usuario",
                        "ALTER INDEX IF EXISTS encuestas_id_usuario_idx RENAME TO encuestas_documento_usuario_idx",
                    ],
                    [
                        "ALTER TABLE usuariosxcuestionarios RENAME COLUMN documento_usuario TO id_usuario",
                        "ALTER TABLE encuestas RENAME COLUMN documento_usuario TO id_usuario",
                        "ALTER INDEX IF EXISTS encuestas_documento_usuario_idx RENAME TO encuestas_id_usuario_idx",
                    ],
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name="asignacioncuestionario",
                    name="usuario",
                    field=models.ForeignKey(
                        db_column="documento_usuario",
                        on_delete=models.deletion.PROTECT,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                migrations.RenameField(model_name="encuesta", old_name="id_usuario", new_name="documento_usuario"),
                migrations.AlterField(
                    model_name="encuesta",
                    name="documento_usuario",
                    field=models.CharField(db_column="documento_usuario", max_length=30),
                ),
            ],
        ),
    ]
