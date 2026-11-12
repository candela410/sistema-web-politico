"""Carga encuestas SIMULADAS para probar estadísticas, analítica y el mapa.

    python manage.py simular_encuestas
    python manage.py simular_encuestas --campana "Campaña Salta 2027" --cantidad 300 --dias 30
    python manage.py simular_encuestas --grupo "Militantes"
    python manage.py simular_encuestas --deshacer simulaciones/simulacion-20261111-031500.json

Las encuestas quedan a nombre de los usuarios de la campaña que pueden cargar
encuestas (o de los del --grupo indicado), repartidas en los últimos --dias
días, en horarios de mañana y de tarde, con respuestas al azar (cada pregunta
con su propia tendencia) y ubicadas cerca del centro de algún barrio.

Antes de guardar muestra un resumen y pide confirmación. Todo lo que crea
queda anotado en backend/simulaciones/; con --deshacer y ese archivo se borra
exactamente lo que se creó (respuesta_cargada no se puede relacionar con su
encuesta, por eso hace falta el archivo).
"""

import json
import random
from datetime import datetime, time, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.cuestionarios_views import cuestionarios_de_campana
from core.geo import centro
from core.models import (
    AsignacionCuestionario,
    Barrio,
    Campana,
    Encuesta,
    Encuestado,
    Pregunta,
    RespuestaCargada,
    Usuario,
)

CARPETA = Path(settings.BASE_DIR) / "simulaciones"
# Documentos de las personas simuladas: desde acá en adelante (DNI que no se usan)
DOCUMENTO_INICIAL = 90_000_000
# Horas en que se encuesta (más a la tarde; los fines de semana, más a la mañana)
HORAS_SEMANA = [10, 11, 12, 17, 18, 18, 19, 19, 20]
HORAS_FINDE = [9, 10, 10, 11, 11, 12, 16, 17]


class Command(BaseCommand):
    help = "Carga encuestas simuladas (con confirmación) o deshace una simulación anterior."

    def add_arguments(self, parser):
        parser.add_argument("--campana", help="nombre o id (por defecto, la única campaña activa)")
        parser.add_argument("--cantidad", type=int, default=200, help="encuestas a crear (por defecto 200)")
        parser.add_argument("--dias", type=int, default=30, help="repartidas en los últimos N días (por defecto 30)")
        parser.add_argument("--grupo", help="solo usuarios de este grupo/rol (por ejemplo: Militantes)")
        parser.add_argument("--si", action="store_true", help="no pedir confirmación")
        parser.add_argument("--deshacer", metavar="ARCHIVO", help="borra lo creado por una simulación anterior")

    def handle(self, **op):
        if op["deshacer"]:
            return self._deshacer(Path(op["deshacer"]))
        if not 1 <= op["cantidad"] <= 5000:
            raise CommandError("--cantidad tiene que estar entre 1 y 5000.")
        if not 1 <= op["dias"] <= 365:
            raise CommandError("--dias tiene que estar entre 1 y 365.")

        campana = self._campana(op["campana"])
        usuarios = self._usuarios(campana, op["grupo"])
        cuestionarios = [
            c for c in cuestionarios_de_campana(campana).filter(activo=True).prefetch_related("preguntas__opciones")
            if any(p.opciones.all() for p in c.preguntas.all())
        ]
        if not cuestionarios:
            raise CommandError(f"La campaña «{campana}» no tiene cuestionarios activos con preguntas.")

        self.stdout.write(f"Campaña: {campana}")
        self.stdout.write(f"Encuestas a crear: {op['cantidad']}, en los últimos {op['dias']} días")
        self.stdout.write("Cargadas por: " + ", ".join(self._nombre(u) for u in usuarios))
        self.stdout.write("Cuestionarios: " + ", ".join(c.titulo for c in cuestionarios))
        if not op["si"] and input("¿Crear estas encuestas simuladas en la base? [s/N] ").strip().lower() != "s":
            self.stdout.write("No se creó nada.")
            return

        creado = self._simular(campana, usuarios, cuestionarios, op["cantidad"], op["dias"])
        CARPETA.mkdir(exist_ok=True)
        (CARPETA / ".gitignore").write_text("*\n")  # estos archivos no se suben a git
        archivo = CARPETA / f"simulacion-{datetime.now():%Y%m%d-%H%M%S}.json"
        archivo.write_text(json.dumps(creado, indent=1))
        self.stdout.write(self.style.SUCCESS(
            f"Listo: {len(creado['encuestas'])} encuestas y {len(creado['respuestas'])} respuestas simuladas."
        ))
        self.stdout.write(f"Para deshacerlo: python manage.py simular_encuestas --deshacer {archivo.relative_to(settings.BASE_DIR)}")

    # --- Elección de campaña, usuarios -------------------------------------

    def _campana(self, valor):
        activas = Campana.objects.filter(activa=True)
        if valor:
            campana = (activas.filter(pk=int(valor)) if valor.isdigit() else activas.filter(nombre__iexact=valor.strip())).first()
            if campana is None:
                raise CommandError("No existe esa campaña activa. Activas: " + ", ".join(map(str, activas)))
            return campana
        if activas.count() != 1:
            raise CommandError("Hay varias campañas activas: indicá una con --campana. Activas: " + ", ".join(map(str, activas)))
        return activas.first()

    def _usuarios(self, campana, grupo):
        usuarios = Usuario.objects.filter(campana=campana, is_active=True, is_superuser=False).select_related("grupo")
        if grupo:
            usuarios = usuarios.filter(grupo__name__iexact=grupo.strip())
        else:
            usuarios = usuarios.filter(grupo__permissions__codename="add_encuesta", grupo__permissions__content_type__app_label="core")
        usuarios = list(usuarios.distinct())
        if not usuarios:
            if grupo:
                raise CommandError(f"La campaña «{campana}» no tiene usuarios activos del grupo «{grupo}».")
            raise CommandError(
                f"La campaña «{campana}» no tiene usuarios activos con un rol que pueda cargar encuestas. "
                "Indicá el rol con --grupo."
            )
        return usuarios

    @staticmethod
    def _nombre(u):
        return u.get_full_name().strip() or u.email

    # --- Simulación --------------------------------------------------------

    def _simular(self, campana, usuarios, cuestionarios, cantidad, dias):
        # Cada militante tiene su ritmo (unos cargan mucho más que otros) y cada
        # pregunta su tendencia (unas opciones salen más que otras)
        ritmo = [random.uniform(0.3, 1.6) for _ in usuarios]
        tendencia = {
            p.pk: [random.gammavariate(1.2, 1) for _ in p.opciones.all()]
            for c in cuestionarios for p in c.preguntas.all()
        }
        puntos = [c for c in (centro(b.geometria) for b in Barrio.objects.exclude(geometria=None)) if c]
        ahora = timezone.localtime()
        usados = set(Encuestado.objects.filter(documento__regex=r"^9\d{7}$").values_list("documento", flat=True))
        documento = DOCUMENTO_INICIAL

        # Primero se arma todo en memoria y después se guarda en bloque: con una
        # base remota (Neon) cada consulta suma demora
        plan, personas, respuestas = [], [], []
        for _ in range(cantidad):
            usuario = random.choices(usuarios, weights=ritmo)[0]
            cuestionario = random.choice(cuestionarios)
            # Un día al azar (más hacia los últimos días) y en horario de calle
            dia = (ahora - timedelta(days=int(dias * (1 - random.random() ** 0.8)))).date()
            horas = HORAS_FINDE if dia.weekday() >= 5 else HORAS_SEMANA
            momento = timezone.make_aware(datetime.combine(dia, time(random.choice(horas), random.randint(0, 59))))
            lat = lng = None
            if puntos and random.random() < 0.85:
                lng, lat = random.choice(puntos)
                lng, lat = round(lng + random.uniform(-0.003, 0.003), 6), round(lat + random.uniform(-0.003, 0.003), 6)
            if momento > ahora:  # hoy, en un horario que todavía no llegó: pasa al día anterior
                momento -= timedelta(days=1)
            plan.append((usuario, cuestionario, momento, lat, lng))

            while str(documento) in usados:
                documento += 1
            usados.add(str(documento))
            personas.append(Encuestado(documento=str(documento)))

            for p in cuestionario.preguntas.all():
                opciones = list(p.opciones.all())
                if not opciones or (not p.obligatoria and random.random() < 0.15):
                    continue
                if p.tipo == Pregunta.Tipo.OPCION_MULTIPLE:
                    k = min(len(opciones), random.choice([1, 1, 2, 2, 3]))
                    elegidas = set()
                    while len(elegidas) < k:
                        elegidas.add(random.choices(opciones, weights=tendencia[p.pk])[0])
                else:
                    elegidas = random.choices(opciones, weights=tendencia[p.pk])
                # Como en la carga real: la respuesta guarda la ubicación de la encuesta
                respuestas += [RespuestaCargada(opcion=o, latitud=lat, longitud=lng) for o in elegidas]

        creado = {"campana": campana.pk, "encuestas": [], "encuestados": [], "respuestas": [], "asignaciones": []}
        with transaction.atomic():
            # Como en la carga real: quien carga queda asignado al cuestionario
            for usuario, cuestionario in {(u, c) for u, c, *_ in plan}:
                _, nueva = AsignacionCuestionario.objects.get_or_create(usuario=usuario, cuestionario=cuestionario)
                if nueva:
                    creado["asignaciones"].append([usuario.pk, cuestionario.pk])

            personas = Encuestado.objects.bulk_create(personas, batch_size=500)
            encuestas = Encuesta.objects.bulk_create(
                [
                    Encuesta(encuestado=persona, cuestionario=c, usuario=u, latitud=lat, longitud=lng)
                    for persona, (u, c, _, lat, lng) in zip(personas, plan)
                ],
                batch_size=500,
            )
            # realizada_en se completa sola con "ahora" al crear: se pone la fecha simulada
            for encuesta, (_, _, momento, _, _) in zip(encuestas, plan):
                encuesta.realizada_en = momento
            Encuesta.objects.bulk_update(encuestas, ["realizada_en"], batch_size=500)
            respuestas = RespuestaCargada.objects.bulk_create(respuestas, batch_size=1000)

        creado["encuestados"] = [p.pk for p in personas]
        creado["encuestas"] = [e.pk for e in encuestas]
        creado["respuestas"] = [r.pk for r in respuestas]
        return creado

    # --- Deshacer ----------------------------------------------------------

    def _deshacer(self, archivo):
        if not archivo.is_absolute():
            archivo = Path(settings.BASE_DIR) / archivo
        if not archivo.exists():
            raise CommandError(f"No existe {archivo}.")
        creado = json.loads(archivo.read_text())
        with transaction.atomic():
            r = RespuestaCargada.objects.filter(pk__in=creado["respuestas"]).delete()[0]
            e = Encuesta.objects.filter(pk__in=creado["encuestas"]).delete()[0]
            # Personas y asignaciones, solo si no se usaron después en encuestas reales
            p = Encuestado.objects.filter(pk__in=creado["encuestados"], encuestas__isnull=True).delete()[0]
            a = 0
            for usuario, cuestionario in creado["asignaciones"]:
                if not Encuesta.objects.filter(usuario_id=usuario, cuestionario_id=cuestionario).exists():
                    a += AsignacionCuestionario.objects.filter(usuario_id=usuario, cuestionario_id=cuestionario).delete()[0]
        archivo.rename(archivo.with_suffix(".deshecha.json"))
        self.stdout.write(self.style.SUCCESS(
            f"Deshecho: {e} encuestas, {r} respuestas, {p} personas y {a} asignaciones borradas."
        ))
