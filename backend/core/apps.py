from django.apps import AppConfig
from django.utils.autoreload import autoreload_started


def vigilar_env(sender, **kwargs):
    # runserver se reinicia solo al guardar backend/.env (ej: al pegar ORS_API_KEY)
    from django.conf import settings

    sender.watch_dir(settings.BASE_DIR, '.env')


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        autoreload_started.connect(vigilar_env)
