"""usuarios: el documento pasa a ser la clave primaria y se borra la columna id.

Las tablas que apuntaban a usuarios.id pasan a guardar el documento:
- usuariosxcuestionarios.id_usuario (parte de su PK compuesta)
- encuestas.id_usuario (parte de la FK compuesta hacia usuariosxcuestionarios)
- django_admin_log.user_id (historial)
Los valores se convierten de id a documento.

encuestas deja de tener las relaciones cuestionario y usuario en Django: quedan
como columnas simples id_cuestionario e id_usuario (id_usuario obligatorio), y
las consultas usan subconsultas. En la base la única FK sigue siendo la
compuesta hacia usuariosxcuestionarios. Se cierran las sesiones abiertas
(guardan el id viejo del usuario). Falla si algún usuario no tiene documento.
"""

from django.db import migrations, models

SQL = r"""
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM usuarios WHERE documento IS NULL OR documento = '') THEN
        RAISE EXCEPTION 'Hay usuarios sin documento: cárguelo antes de migrar';
    END IF;
END $$;

DELETE FROM django_session;

-- Restricciones que dependen de usuarios.id
ALTER TABLE encuestas DROP CONSTRAINT fk_encuesta_usuariosxcuestionarios;
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT conrelid::regclass AS tabla, conname FROM pg_constraint
             WHERE confrelid = 'usuarios'::regclass AND contype = 'f' LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabla, r.conname);
    END LOOP;
END $$;
ALTER TABLE usuariosxcuestionarios DROP CONSTRAINT usuariosxcuestionarios_pkey;

-- usuariosxcuestionarios.id_usuario: id -> documento
ALTER TABLE usuariosxcuestionarios ADD COLUMN doc varchar(30);
UPDATE usuariosxcuestionarios t SET doc = u.documento FROM usuarios u WHERE u.id = t.id_usuario;
ALTER TABLE usuariosxcuestionarios DROP COLUMN id_usuario;
ALTER TABLE usuariosxcuestionarios RENAME COLUMN doc TO id_usuario;
ALTER TABLE usuariosxcuestionarios ALTER COLUMN id_usuario SET NOT NULL;

-- encuestas.id_usuario: id -> documento
ALTER TABLE encuestas ADD COLUMN doc varchar(30);
UPDATE encuestas t SET doc = u.documento FROM usuarios u WHERE u.id = t.id_usuario;
ALTER TABLE encuestas DROP COLUMN id_usuario;
ALTER TABLE encuestas RENAME COLUMN doc TO id_usuario;
ALTER TABLE encuestas ALTER COLUMN id_usuario SET NOT NULL;

-- django_admin_log.user_id: id -> documento
ALTER TABLE django_admin_log ADD COLUMN doc varchar(30);
UPDATE django_admin_log t SET doc = u.documento FROM usuarios u WHERE u.id = t.user_id;
ALTER TABLE django_admin_log DROP COLUMN user_id;
ALTER TABLE django_admin_log RENAME COLUMN doc TO user_id;
ALTER TABLE django_admin_log ALTER COLUMN user_id SET NOT NULL;

-- usuarios: documento como PK, sin id
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'usuarios'::regclass AND contype IN ('p', 'u')
               AND pg_get_constraintdef(oid) IN ('PRIMARY KEY (id)', 'UNIQUE (documento)') LOOP
        EXECUTE format('ALTER TABLE usuarios DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE usuarios ALTER COLUMN documento SET NOT NULL;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (documento);
ALTER TABLE usuarios DROP COLUMN id;

-- Claves y FK de nuevo, ahora sobre el documento
ALTER TABLE usuariosxcuestionarios ADD CONSTRAINT usuariosxcuestionarios_pkey
    PRIMARY KEY (id_usuario, id_cuestionario);
ALTER TABLE usuariosxcuestionarios ADD CONSTRAINT usuariosxcuestionarios_id_usuario_fk_usuarios
    FOREIGN KEY (id_usuario) REFERENCES usuarios(documento) ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE encuestas ADD CONSTRAINT fk_encuesta_usuariosxcuestionarios
    FOREIGN KEY (id_usuario, id_cuestionario)
    REFERENCES usuariosxcuestionarios(id_usuario, id_cuestionario) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE django_admin_log ADD CONSTRAINT django_admin_log_user_id_fk_usuarios
    FOREIGN KEY (user_id) REFERENCES usuarios(documento) ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX encuestas_id_usuario_idx ON encuestas (id_usuario);
CREATE INDEX django_admin_log_user_id_idx ON django_admin_log (user_id);
"""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0030_encuestas_solo_fk_a_asignaciones"),
        ("admin", "0003_logentry_add_action_flag_choices"),
        ("sessions", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(SQL, migrations.RunSQL.noop)],
            state_operations=[
                migrations.RemoveConstraint(model_name="encuesta", name="uq_encuesta_encuestado_cuestionario"),
                migrations.RemoveField(model_name="encuesta", name="cuestionario"),
                migrations.RemoveField(model_name="encuesta", name="usuario"),
                migrations.AddField(
                    model_name="encuesta",
                    name="id_cuestionario",
                    field=models.IntegerField(db_column="id_cuestionario"),
                ),
                migrations.AddField(
                    model_name="encuesta",
                    name="id_usuario",
                    field=models.CharField(max_length=30, db_column="id_usuario"),
                ),
                migrations.AddConstraint(
                    model_name="encuesta",
                    constraint=models.UniqueConstraint(
                        fields=["encuestado", "id_cuestionario"], name="uq_encuesta_encuestado_cuestionario"
                    ),
                ),
                migrations.RemoveField(model_name="usuario", name="id"),
                migrations.AlterField(
                    model_name="usuario",
                    name="documento",
                    field=models.CharField(max_length=30, primary_key=True, serialize=False),
                ),
            ],
        ),
    ]
