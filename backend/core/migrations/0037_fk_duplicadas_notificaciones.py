"""En notificaciones y preferencias_notificaciones quedaba, además de la FK con
ON UPDATE CASCADE, la FK que crea Django al final de la migración (sin
cascada). Se borra esa: queda una sola FK al documento, con cascada."""

from django.db import migrations

SQL = """
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT conrelid::regclass AS tabla, conname FROM pg_constraint
             WHERE contype = 'f' AND confrelid = 'usuarios'::regclass
               AND conrelid IN ('notificaciones'::regclass, 'preferencias_notificaciones'::regclass)
               AND pg_get_constraintdef(oid) NOT LIKE '%ON UPDATE CASCADE%' LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabla, r.conname);
    END LOOP;
END $$;
"""


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0036_preferencias_notificaciones"),
    ]

    operations = [
        migrations.RunSQL(SQL, migrations.RunSQL.noop),
    ]
