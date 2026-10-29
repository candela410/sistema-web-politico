"""usuariosxcuestionarios pasa a tener clave primaria compuesta
(id_usuario, id_cuestionario), sin id propio, y encuestas.(id_usuario,
id_cuestionario) pasa a ser FK hacia esa clave.

Django no sabe cambiar la clave primaria de una tabla existente ni crear FK
hacia claves compuestas, así que la base se modifica con SQL (PostgreSQL) y
el modelo se actualiza aparte (state_operations).
"""

from django.db import migrations, models

SQL_POSTGRES = [
    # Las FK de Django son diferidas: hay que dispararlas ya para poder hacer ALTER TABLE
    "SET CONSTRAINTS ALL IMMEDIATE",
    # Las encuestas ya cargadas sin asignación reciben la suya (si no, la FK falla)
    """
    INSERT INTO usuariosxcuestionarios (id_usuario, id_cuestionario, asignado_en)
    SELECT DISTINCT e.id_usuario, e.id_cuestionario, NOW()
    FROM encuestas e
    WHERE e.id_usuario IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM usuariosxcuestionarios a
          WHERE a.id_usuario = e.id_usuario AND a.id_cuestionario = e.id_cuestionario
      )
    """,
    "ALTER TABLE usuariosxcuestionarios DROP CONSTRAINT IF EXISTS uq_usuario_cuestionario",
    "ALTER TABLE usuariosxcuestionarios DROP COLUMN id",
    "ALTER TABLE usuariosxcuestionarios ADD PRIMARY KEY (id_usuario, id_cuestionario)",
    # FK compuesta: una encuesta la carga un usuario con ese cuestionario asignado.
    # Si id_usuario es NULL (encuestas viejas sin militante) no se controla.
    """
    ALTER TABLE encuestas ADD CONSTRAINT fk_encuesta_usuariosxcuestionarios
    FOREIGN KEY (id_usuario, id_cuestionario)
    REFERENCES usuariosxcuestionarios (id_usuario, id_cuestionario)
    ON DELETE RESTRICT
    """,
]

SQL_POSTGRES_REVERSA = [
    "SET CONSTRAINTS ALL IMMEDIATE",
    "ALTER TABLE encuestas DROP CONSTRAINT fk_encuesta_usuariosxcuestionarios",
    "ALTER TABLE usuariosxcuestionarios DROP CONSTRAINT usuariosxcuestionarios_pkey",
    "ALTER TABLE usuariosxcuestionarios ADD COLUMN id bigserial PRIMARY KEY",
    """ALTER TABLE usuariosxcuestionarios ADD CONSTRAINT uq_usuario_cuestionario
    UNIQUE (id_usuario, id_cuestionario)""",
]


def _ejecutar(sentencias):
    def aplicar(apps, schema_editor):
        # En SQLite (pruebas) la tabla queda como estaba; el control lo hace el código
        if schema_editor.connection.vendor != "postgresql":
            return
        for sql in sentencias:
            schema_editor.execute(sql)

    return aplicar


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_encuestado_sin_asignacion'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveConstraint(
                    model_name='asignacioncuestionario',
                    name='uq_usuario_cuestionario',
                ),
                migrations.AddField(
                    model_name='asignacioncuestionario',
                    name='pk',
                    field=models.CompositePrimaryKey('usuario', 'cuestionario', blank=True, editable=False, primary_key=True, serialize=False),
                ),
                migrations.RemoveField(
                    model_name='asignacioncuestionario',
                    name='id',
                ),
            ],
            database_operations=[
                migrations.RunPython(_ejecutar(SQL_POSTGRES), _ejecutar(SQL_POSTGRES_REVERSA)),
            ],
        ),
    ]
