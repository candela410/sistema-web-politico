from django.apps import AppConfig
from django.utils.autoreload import autoreload_started


def vigilar_env(sender, **kwargs):
    # runserver se reinicia solo al guardar backend/.env (ej: al pegar ORS_API_KEY)
    from django.conf import settings

    sender.watch_dir(settings.BASE_DIR, '.env')


def nombres_con_mayuscula(sender, instance, **kwargs):
    # Antes de guardar: personas con mayúscula en cada palabra, cosas y
    # títulos con la primera letra en mayúscula
    from .models import CAMPOS_NOMBRE, CAMPOS_PERSONA, MODELOS_PERSONA, con_mayuscula, nombre_propio

    if sender.__name__ in MODELOS_PERSONA:
        campos, regla = CAMPOS_PERSONA, nombre_propio
    else:
        campos, regla = CAMPOS_NOMBRE, con_mayuscula
    for campo in campos:
        if hasattr(instance, campo):
            setattr(instance, campo, regla(getattr(instance, campo)))


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        from django.db.models.signals import pre_save

        autoreload_started.connect(vigilar_env)
        for modelo in self.get_models():
            if any(f.name in ("nombre", "first_name", "titulo") for f in modelo._meta.fields):
                pre_save.connect(nombres_con_mayuscula, sender=modelo, dispatch_uid=f"mayuscula-{modelo.__name__}")
