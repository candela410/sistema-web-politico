"""Crea las notificaciones de la campanita (tabla notificaciones).

- Personales: van directo a un usuario (cuestionario asignado, contraseña cambiada).
- Por permiso: van a cada usuario activo cuyo rol tiene el permiso
  "Recibir aviso de ..." (y a los superusuarios). Se crea una fila por usuario,
  así cada uno marca como leídas las suyas.

Si crear una notificación falla, se registra en el log y la acción que la
generó sigue igual: un aviso nunca debe impedir cargar una encuesta o guardar.
"""

import logging

from django.db.models import Q
from django.utils import timezone

from .models import Notificacion, Usuario

registro = logging.getLogger(__name__)
Tipo = Notificacion.Tipo


def notificar(usuarios, tipo, titulo, mensaje, enlace=None):
    """Una notificación igual para cada usuario de la lista."""
    try:
        Notificacion.objects.bulk_create(
            [Notificacion(usuario=u, tipo=tipo, titulo=titulo, mensaje=mensaje, enlace=enlace) for u in usuarios]
        )
    except Exception:  # noqa: BLE001
        registro.exception("No se pudo crear la notificación %s", tipo)


def con_permiso(codename, campana=None, excluir=None):
    """Usuarios activos que reciben un tipo de aviso: su rol tiene el permiso
    core.<codename>, o son superusuarios. Con campaña, solo los de esa campaña
    (los superusuarios trabajan en todas)."""
    usuarios = Usuario.objects.filter(is_active=True).filter(
        Q(grupo__permissions__codename=codename, grupo__permissions__content_type__app_label="core")
        | Q(is_superuser=True)
    )
    if campana is not None:
        usuarios = usuarios.filter(Q(campana=campana) | Q(is_superuser=True))
    if excluir is not None:
        usuarios = usuarios.exclude(pk=excluir.pk)
    return usuarios.distinct()


# ---------------------------------------------------------------------------
# Avisos del sistema
# ---------------------------------------------------------------------------


def cuestionario_asignado(usuarios, cuestionario):
    notificar(
        usuarios, Tipo.CUESTIONARIO_ASIGNADO, "Se le asignó un cuestionario",
        f"{cuestionario.titulo}: ya puede cargar encuestas.", f"/responder/{cuestionario.pk}",
    )


def encuesta_cargada(quien, cuestionario, campana):
    """A quienes reciben el aviso, sin contar a quien la cargó. Para no llenar
    la campanita, por día y cuestionario hay un solo aviso sin leer por usuario
    que se va actualizando con la cantidad de encuestas."""
    try:
        from .models import Encuesta

        hoy = timezone.localdate()
        cantidad = Encuesta.objects.filter(id_cuestionario=cuestionario.pk, realizada_en__date=hoy).count()
        titulo = "Encuestas cargadas"
        mensaje = (
            f"Hoy se cargaron {cantidad} encuestas de {cuestionario.titulo}. La última, de {nombre(quien)}."
            if cantidad > 1 else f"{nombre(quien)} cargó una encuesta de {cuestionario.titulo}."
        )
        enlace = f"/cuestionarios/{cuestionario.pk}/estadisticas"
        for usuario in con_permiso("recibir_encuesta_cargada", campana, excluir=quien):
            existente = Notificacion.objects.filter(
                usuario=usuario, tipo=Tipo.ENCUESTA_CARGADA, enlace=enlace, leida=False, creada_en__date=hoy
            ).first()
            if existente:
                existente.mensaje = mensaje
                existente.save(update_fields=["mensaje"])
            else:
                notificar([usuario], Tipo.ENCUESTA_CARGADA, titulo, mensaje, enlace)
    except Exception:  # noqa: BLE001
        registro.exception("No se pudo avisar la encuesta cargada")


def backup_fallido(error):
    notificar(
        con_permiso("recibir_backup_fallido"), Tipo.BACKUP_FALLIDO, "Falló el backup automático",
        f"No se pudo hacer el backup programado: {error}", "/configuracion/backup",
    )


def contrasena_cambiada(usuario):
    notificar(
        [usuario], Tipo.CONTRASENA_CAMBIADA, "Se cambió su contraseña",
        "Si no fue usted, avise a un administrador y pida restablecerla.", "/configuracion",
    )


def nombre(usuario):
    return f"{usuario.first_name} {usuario.last_name}".strip() or usuario.email
