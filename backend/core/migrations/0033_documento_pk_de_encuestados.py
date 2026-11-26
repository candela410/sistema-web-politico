"""encuestados: el documento pasa a ser la clave primaria y se borra
id_encuestado. encuestas.id_encuestado pasa a ser documento_encuestado (guarda
el documento) y la FK tiene ON UPDATE CASCADE. La restricción única
uq_encuesta_encuestado_cuestionario queda sobre (documento_encuestado,
id_cuestionario)."""

from django.db import migrations, models

SQL = r"""
ALTER TABLE encuestas DROP CONSTRAINT IF EXISTS uq_encuesta_encuestado_cuestionario;
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT conrelid::regclass AS tabla, conname FROM pg_constraint
             WHERE confrelid = 'encuestados'::regclass AND contype = 'f' LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabla, r.conname);
    END LOOP;
END $$;

ALTER TABLE encuestas ADD COLUMN documento_encuestado varchar(30);
UPDATE encuestas t SET documento_encuestado = e.documento FROM encuestados e WHERE e.id_encuestado = t.id_encuestado;
ALTER TABLE encuestas ALTER COLUMN documento_encuestado SET NOT NULL;
ALTER TABLE encuestas DROP COLUMN id_encuestado;

ALTER TABLE encuestados DROP CONSTRAINT encuestados_pkey;
ALTER TABLE encuestados DROP CONSTRAINT IF EXISTS encuestados_documento_key;
ALTER TABLE encuestados ADD CONSTRAINT encuestados_pkey PRIMARY KEY (documento);
ALTER TABLE encuestados DROP COLUMN id_encuestado;

ALTER TABLE encuestas ADD CONSTRAINT encuestas_documento_encuestado_fk_encuestados
    FOREIGN KEY (documento_encuestado) REFERENCES encuestados(documento)
    ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE encuestas ADD CONSTRAINT uq_encuesta_encuestado_cuestionario
    UNIQUE (documento_encuestado, id_cuestionario);
"""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0032_documento_usuario"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(SQL, migrations.RunSQL.noop)],
            state_operations=[
                migrations.RemoveConstraint(model_name="encuesta", name="uq_encuesta_encuestado_cuestionario"),
                migrations.RemoveField(model_name="encuestado", name="id_encuestado"),
                migrations.AlterField(
                    model_name="encuestado",
                    name="documento",
                    field=models.CharField(max_length=30, primary_key=True, serialize=False),
                ),
                migrations.AlterField(
                    model_name="encuesta",
                    name="encuestado",
                    field=models.ForeignKey(
                        db_column="documento_encuestado",
                        on_delete=models.deletion.PROTECT,
                        related_name="encuestas",
                        to="core.encuestado",
                    ),
                ),
                migrations.AddConstraint(
                    model_name="encuesta",
                    constraint=models.UniqueConstraint(
                        fields=["encuestado", "id_cuestionario"], name="uq_encuesta_encuestado_cuestionario"
                    ),
                ),
            ],
        ),
    ]
