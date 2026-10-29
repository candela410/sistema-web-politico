from django.apps import AppConfig
from django.utils.autoreload import autoreload_started


def vigilar_env(sender, **kwargs):
    # runserver se reinicia solo al guardar backend/.env (ej: al pegar ORS_API_KEY)
    from django.conf import settings

    sender.watch_dir(settings.BASE_DIR, '.env')


def nombres_con_mayuscula(sender, instance, **kwargs):
    # Antes de guardar cualquier modelo de core: primera letra en mayúscula
    from .models import CAMPOS_NOMBRE, con_mayuscula

    for campo in CAMPOS_NOMBRE:
        if hasattr(instance, campo):
            setattr(instance, campo, con_mayuscula(getattr(instance, campo)))


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        from django.db.models.signals import pre_save

        autoreload_started.connect(vigilar_env)
        for modelo in self.get_models():
            if any(f.name in ("nombre", "first_name") for f in modelo._meta.fields):
                pre_save.connect(nombres_con_mayuscula, sender=modelo, dispatch_uid=f"mayuscula-{modelo.__name__}")
