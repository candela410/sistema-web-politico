#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
        from django.core.management.commands.runserver import Command as Runserver
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    # "python manage.py runserver" escucha por defecto solo en 127.0.0.1, y el
    # celular (que entra por la IP de la compu, ej. 192.168.100.26:8000) recibe
    # "conexión rechazada". Se escucha en todas las interfaces de red; con la
    # variable de entorno DJANGO_RUNSERVER_ADDR=127.0.0.1 se vuelve al comportamiento de Django.
    Runserver.default_addr = os.environ.get('DJANGO_RUNSERVER_ADDR', '0.0.0.0')
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
