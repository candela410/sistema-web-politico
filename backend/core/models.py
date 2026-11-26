import re
import unicodedata
from datetime import time

from django.conf import settings
from django.contrib.auth.models import AbstractUser, Permission
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

def con_mayuscula(texto):
    """Primera letra en mayúscula, el resto como se escribió ("barrio norte" → "Barrio norte")."""
    if not isinstance(texto, str):
        return texto
    texto = texto.strip()
    return texto[:1].upper() + texto[1:]


def nombre_propio(texto):
    """Nombre o apellido de una persona: mayúscula al principio de cada palabra
    ("maría josé" → "María José", "o'connor" → "O'Connor"). Igual que
    nombrePropio del frontend."""
    if not isinstance(texto, str):
        return texto
    texto = re.sub(r"\s+", " ", texto).strip()
    return re.sub(r"(^|[\s'\-])(\w)", lambda m: m.group(1) + m.group(2).upper(), texto)


# Campos que se guardan siempre empezando con mayúscula (ver CoreConfig.ready()):
# - nombres de personas (usuarios y encuestados): cada palabra
# - nombres de cosas y títulos (campaña, zona, cuestionario…): la primera letra
CAMPOS_PERSONA = ("first_name", "last_name", "nombre", "apellido")
MODELOS_PERSONA = ("Usuario", "Encuestado")
CAMPOS_NOMBRE = ("nombre", "titulo")


NUMERO = re.compile(r"^\s*-?\d+([.,]\d+)?\s*$")


def numero_de(texto):
    """Convierte "4", "4,5" o "4.5" en número; None si no es un número."""
    if not NUMERO.match(str(texto)):
        return None
    return float(str(texto).strip().replace(",", "."))


# Convenciones:
# - Clases en singular (convención de Django); las tablas conservan su nombre.
# - Las FK se llaman como la entidad (zona, barrio...) y la columna en la base
#   se llama id_zona, id_barrio... gracias a db_column. Sin db_column Django
#   crearía columnas "id_zona_id".
# - Las figuras del mapa se guardan como GeoJSON (https://geojson.org/) en
#   campos JSON, en el formato que devuelven Leaflet-Geoman y OpenRouteService.


class Campana(models.Model):
    id_campana = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=150, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    # Sin fechas: lo que decide si se puede trabajar en ella es "activa"
    activa = models.BooleanField(default=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "campanas"
        verbose_name = "campaña"
        verbose_name_plural = "campañas"
        ordering = ["-activa", "nombre"]

    def __str__(self):
        return self.nombre


# ---------------------------------------------------------------------------
# Territorio
# ---------------------------------------------------------------------------


class Zona(models.Model):
    # Las zonas son territorio: las mismas para todas las campañas
    id_zona = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    # Polígono dibujado en el mapa (GeoJSON Polygon/MultiPolygon)
    geometria = models.JSONField(blank=True, null=True)
    color = models.CharField(max_length=7, blank=True, default="")  # "#RRGGBB"

    class Meta:
        db_table = "zonas"
        verbose_name = "zona"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Barrio(models.Model):
    id_barrio = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120, unique=True)
    # Los barrios se cargan primero (desde OpenStreetMap); la zona se asigna
    # después, al dibujar zonas en el mapa.
    zona = models.ForeignKey(
        Zona,
        on_delete=models.SET_NULL,
        db_column="id_zona",
        null=True,
        blank=True,
        related_name="barrios",
    )
    geometria = models.JSONField(blank=True, null=True)
    # True cuando OpenStreetMap solo tiene un punto para el barrio y el
    # contorno se estimó (ver importar_osm)
    geometria_aproximada = models.BooleanField(default=False)
    osm_id = models.BigIntegerField(unique=True, null=True, blank=True)

    class Meta:
        db_table = "barrios"
        verbose_name = "barrio"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Calle(models.Model):
    id_calle = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=150)
    barrio = models.ForeignKey(
        Barrio,
        on_delete=models.PROTECT,
        db_column="id_barrio",
        related_name="calles",
    )
    # Tramos de la calle dentro del barrio (GeoJSON MultiLineString)
    geometria = models.JSONField(blank=True, null=True)
    # Ruta que pasa por esta calle (se asigna sola al guardar la ruta, según
    # su recorrido). Una calle pertenece a una sola ruta.
    ruta = models.ForeignKey(
        "Ruta",
        on_delete=models.SET_NULL,
        db_column="id_ruta",
        null=True,
        blank=True,
        related_name="calles",
    )

    class Meta:
        db_table = "calles"
        verbose_name = "calle"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(
                fields=["barrio", "nombre"],
                name="uq_calle_barrio_nombre",
            )
        ]

    def __str__(self):
        return self.nombre


class Ruta(models.Model):
    # Sin campaña ni zona propias (como en el DER): la campaña sale de
    # equipos → usuarios y la zona de calles → barrios (ver mapa_views)
    id_ruta = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    class Perfil(models.TextChoices):
        A_PIE = "foot-walking", "A pie"
        AUTO = "driving-car", "En auto"
        BICICLETA = "cycling-regular", "En bicicleta"

    perfil = models.CharField(max_length=30, choices=Perfil, default=Perfil.A_PIE)
    # Puntos marcados en el mapa, en orden: [[lng, lat], ...]
    paradas = models.JSONField(default=list, blank=True)
    # Recorrido calculado por OpenRouteService (GeoJSON LineString)
    geometria = models.JSONField(blank=True, null=True)
    distancia_m = models.PositiveIntegerField(blank=True, null=True)
    duracion_s = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        db_table = "rutas"
        verbose_name = "ruta"

    def __str__(self):
        return self.nombre


class Equipo(models.Model):
    id_equipo = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    # Obligatoria: no se puede crear un equipo sin ruta asignada, ni borrar
    # una ruta que tiene equipos. La campaña sale de sus usuarios.
    ruta = models.ForeignKey(
        Ruta,
        on_delete=models.PROTECT,
        db_column="id_ruta",
        related_name="equipos",
    )
    # Un equipo con ruta no se borra: se desactiva
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "equipos"
        verbose_name = "equipo"

    def __str__(self):
        return self.nombre


# ---------------------------------------------------------------------------
# Personas
# ---------------------------------------------------------------------------


def base_username(nombre, apellido):
    """Nombre de usuario según la regla del sistema: el apellido y la primera
    letra del nombre, en minúsculas y sin acentos ni espacios
    ("José" + "Pérez Gil" → "perezgilj")."""

    def limpio(texto):
        sin_acentos = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9]", "", sin_acentos.lower())

    nombre, apellido = limpio(nombre), limpio(apellido)
    return (apellido + nombre[:1] if apellido else nombre)[:140] or "usuario"


def username_libre(nombre, apellido, usuario=None):
    """La regla de base_username; si ya lo usa otra persona se le agrega un
    número (perezj, perezj2, perezj3...). `usuario`: a quién se le va a poner
    (conserva el que tiene si sigue correspondiendo a su nombre)."""
    base = base_username(nombre, apellido)
    if usuario is not None and re.fullmatch(rf"{re.escape(base)}\d*", usuario.username or ""):
        return usuario.username
    otros = Usuario.objects.all() if usuario is None or usuario.pk is None else Usuario.objects.exclude(pk=usuario.pk)
    candidato, n = base, 1
    while otros.filter(username__iexact=candidato).exists():
        n += 1
        candidato = f"{base}{n}"
    return candidato


# Usuario del sistema: reemplaza a auth_user. Los grupos y permisos
# son los de Django (auth_group, auth_permission, auth_group_permissions).
# Sin usuarios_groups ni usuarios_user_permissions: el rol es solo
# usuarios.id_grupo y los permisos salen de ese grupo (core/backends.py).
class Usuario(AbstractUser):
    # Se ingresa con el nombre de usuario (username: apellido + inicial del
    # nombre, ver base_username). El correo es único: a él llegan los enlaces
    # para elegir la contraseña.
    email = models.EmailField(unique=True)

    campana = models.ForeignKey(
        Campana,
        on_delete=models.PROTECT,
        db_column="id_campana",
        null=True,
        blank=True,
        related_name="usuarios",
    )
    # Rol del usuario: FK a la tabla de grupos de Django (auth_group). Un
    # usuario tiene un solo grupo y un grupo muchos usuarios. Los permisos se
    # toman de ese grupo (auth_group_permissions).
    grupo = models.ForeignKey(
        "auth.Group",
        on_delete=models.SET_NULL,
        db_column="id_grupo",
        null=True,
        blank=True,
        related_name="usuarios",
    )

    # Datos de la persona (antes estaban en la tabla militantes)
    # Clave primaria: el documento identifica al usuario (no hay columna id).
    # Lo usan como FK usuariosxcuestionarios, encuestas y django_admin_log,
    # por eso no se puede cambiar después de crear el usuario.
    documento = models.CharField(max_length=30, primary_key=True)
    telefono = models.CharField(max_length=40, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    # Foto de perfil: imagen chica (256 px) como "data:image/jpeg;base64,...".
    # Va en la base porque el servidor no conserva archivos entre despliegues.
    foto = models.TextField(blank=True, null=True)
    equipo = models.ForeignKey(
        Equipo,
        on_delete=models.SET_NULL,
        db_column="id_equipo",
        null=True,
        blank=True,
        related_name="usuarios",
    )

    # Se quitan las relaciones de AbstractUser con grupos y permisos sueltos
    # (tablas usuarios_groups y usuarios_user_permissions)
    groups = None
    user_permissions = None

    # Se ingresa con el nombre de usuario, nunca con el correo (también en /admin)
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email", "documento"]

    class Meta:
        db_table = "usuarios"
        verbose_name = "usuario"


class ConfiguracionBackup(models.Model):
    """Programación del backup automático (pantalla Configuración → Backup).
    Una sola fila (id = 1). Los backups en sí no se guardan acá: son snapshots
    de Neon y se listan con su API (ver backup.py)."""

    class Frecuencia(models.TextChoices):
        DIARIA = "diaria", "Todos los días"
        SEMANAL = "semanal", "Una vez por semana"

    activo = models.BooleanField(default=False)
    frecuencia = models.CharField(max_length=10, choices=Frecuencia, default=Frecuencia.DIARIA)
    # Día del backup semanal: 0 = lunes ... 6 = domingo
    dia_semana = models.PositiveSmallIntegerField(default=0)
    hora = models.TimeField(default=time(3, 0))
    # Los horarios programados hasta este momento ya se atendieron (o son
    # anteriores a la última vez que se cambió la programación)
    controlado_hasta = models.DateTimeField(blank=True, null=True)
    ultimo_automatico = models.DateTimeField(blank=True, null=True)
    ultimo_error = models.TextField(blank=True, default="")

    class Meta:
        db_table = "configuracion_backup"
        verbose_name = "configuración de backup"
        # Solo superusuarios: no genera permisos para asignar a los roles
        default_permissions = ()
        constraints = [
            models.CheckConstraint(condition=Q(dia_semana__lte=6), name="ck_backup_dia_semana"),
        ]

    @classmethod
    def actual(cls):
        return cls.objects.get_or_create(pk=1)[0]


class Encuestado(models.Model):
    # Clave primaria: el documento identifica a la persona (no hay columna
    # id). Que responda una sola vez cada cuestionario lo controla Encuesta
    # (uq_encuesta_encuestado_cuestionario).
    documento = models.CharField(max_length=30, primary_key=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)
    apellido = models.CharField(max_length=100, blank=True, null=True)
    # Quién lo encuestó y con qué cuestionario queda en la tabla encuestas.

    # Ubicación del domicilio para mostrarlo como punto en el mapa
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "encuestados"
        verbose_name = "encuestado"
        constraints = [
            models.CheckConstraint(
                condition=Q(latitud__isnull=True, longitud__isnull=True)
                | Q(
                    latitud__gte=-90,
                    latitud__lte=90,
                    longitud__gte=-180,
                    longitud__lte=180,
                ),
                name="ck_encuestado_coordenadas",
            )
        ]

    def __str__(self):
        return f"{self.nombre or ''} {self.apellido or ''}".strip() or self.documento


# ---------------------------------------------------------------------------
# Cuestionarios
# ---------------------------------------------------------------------------


class Categoria(models.Model):
    id_categoria = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    # Al desactivarla se desactivan sus cuestionarios (ver categorias_views)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "categorias"
        verbose_name = "categoría"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Cuestionario(models.Model):
    id_cuestionario = models.AutoField(primary_key=True)
    titulo = models.CharField(max_length=180)
    descripcion = models.TextField(blank=True, null=True)

    # Sin campaña propia (como en el DER): la campaña sale de los usuarios a
    # los que está asignado (cuestionarios → usuariosxcuestionarios → usuarios)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        db_column="id_categoria",
        related_name="cuestionarios",
    )

    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    usuarios = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="AsignacionCuestionario",
        related_name="cuestionarios_asignados",
    )

    class Meta:
        db_table = "cuestionarios"
        verbose_name = "cuestionario"

    def __str__(self):
        return self.titulo


class AsignacionCuestionario(models.Model):
    # Clave primaria compuesta (documento_usuario, id_cuestionario), sin id propio.
    # encuestas.(documento_usuario, id_cuestionario) es FK a esta tabla (la crea la
    # migración 0020 en la base: Django no maneja FK hacia claves compuestas).
    pk = models.CompositePrimaryKey("usuario", "cuestionario")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="documento_usuario",
    )
    cuestionario = models.ForeignKey(
        Cuestionario,
        on_delete=models.PROTECT,
        db_column="id_cuestionario",
    )
    asignado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "usuariosxcuestionarios"
        verbose_name = "asignación de cuestionario"


class Pregunta(models.Model):
    # Toda pregunta se responde eligiendo opciones. Si todas las opciones son
    # números la variable es cuantitativa; si no, cualitativa (ver variable()).
    class Tipo(models.TextChoices):
        UNA_OPCION = "una_opcion", "Una sola opción"
        OPCION_MULTIPLE = "opcion_multiple", "Opción múltiple"

    class Variable(models.TextChoices):
        CUALITATIVA = "cualitativa", "Cualitativa"
        CUANTITATIVA = "cuantitativa", "Cuantitativa"

    id_pregunta = models.AutoField(primary_key=True)
    enunciado = models.TextField()
    tipo = models.CharField(max_length=30, choices=Tipo, default=Tipo.UNA_OPCION)
    orden = models.PositiveIntegerField(default=1)
    obligatoria = models.BooleanField(default=False)

    cuestionario = models.ForeignKey(
        Cuestionario,
        on_delete=models.CASCADE,
        db_column="id_cuestionario",
        related_name="preguntas",
    )

    class Meta:
        db_table = "preguntas"
        verbose_name = "pregunta"
        ordering = ["orden"]
        constraints = [
            models.UniqueConstraint(
                fields=["cuestionario", "orden"],
                name="uq_pregunta_cuestionario_orden",
            )
        ]

    def __str__(self):
        return self.enunciado

    @staticmethod
    def variable_de(textos):
        """Cuantitativa si todas las opciones son números; si no, cualitativa."""
        textos = list(textos)
        if textos and all(numero_de(t) is not None for t in textos):
            return Pregunta.Variable.CUANTITATIVA
        return Pregunta.Variable.CUALITATIVA

    def variable(self):
        return self.variable_de(o.texto for o in self.opciones.all())


class Opcion(models.Model):
    id_opcion = models.AutoField(primary_key=True)
    texto = models.TextField()
    orden = models.PositiveIntegerField(default=1)

    pregunta = models.ForeignKey(
        Pregunta,
        on_delete=models.CASCADE,
        db_column="id_pregunta",
        related_name="opciones",
    )

    class Meta:
        db_table = "opciones"
        verbose_name = "opción"
        verbose_name_plural = "opciones"
        ordering = ["orden"]
        constraints = [
            models.UniqueConstraint(
                fields=["pregunta", "orden"],
                name="uq_opcion_pregunta_orden",
            )
        ]

    def __str__(self):
        return self.texto


# ---------------------------------------------------------------------------
# Carga de encuestas
# ---------------------------------------------------------------------------


# Una visita: un usuario (militante) le toma un cuestionario a un encuestado.
# Guarda quién cargó la encuesta, cuándo y dónde (para el mapa).
class Encuesta(models.Model):
    id_encuesta = models.AutoField(primary_key=True)
    encuestado = models.ForeignKey(
        Encuestado,
        on_delete=models.PROTECT,
        db_column="documento_encuestado",
        related_name="encuestas",
    )
    # documento_usuario + id_cuestionario forman la FK compuesta hacia
    # usuariosxcuestionarios (fk_encuesta_usuariosxcuestionarios): una encuesta
    # solo se carga con un cuestionario asignado a quien la carga. Como en el
    # DER no hay FK directas a cuestionarios ni a usuarios: son columnas
    # simples y el cuestionario o el usuario se buscan con subconsultas
    # (ver encuestas_de en cuestionarios_views y mapa_encuestas).
    id_cuestionario = models.IntegerField(db_column="id_cuestionario")
    # Quién cargó la encuesta (su documento)
    documento_usuario = models.CharField(max_length=30, db_column="documento_usuario")
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    realizada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "encuestas"
        verbose_name = "encuesta"
        constraints = [
            # Una persona responde una sola vez cada cuestionario
            models.UniqueConstraint(
                fields=["encuestado", "id_cuestionario"],
                name="uq_encuesta_encuestado_cuestionario",
            )
        ]

    def __str__(self):
        return f"{self.encuestado} - cuestionario {self.id_cuestionario}"


class RespuestaCargada(models.Model):
    # Como en el DER, la única FK es id_opcion. La pregunta y el cuestionario
    # salen de la opción (opciones → preguntas → cuestionarios).
    id_respuesta = models.AutoField(primary_key=True)
    # PROTECT: borrar una opción nunca elimina respuestas cargadas
    opcion = models.ForeignKey(
        Opcion,
        on_delete=models.PROTECT,
        db_column="id_opcion",
        related_name="respuestas",
    )
    # Ubicación del celular al cargar la respuesta: con ella se sabe en qué
    # zona se respondió (Dashboard). Las respuestas anteriores no la tienen.
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    class Meta:
        db_table = "respuesta_cargada"
        verbose_name = "respuesta cargada"
        verbose_name_plural = "respuestas cargadas"


# ---------------------------------------------------------------------------
# Notificaciones (campanita de la barra superior)
# ---------------------------------------------------------------------------


# Un aviso para un usuario. Los avisos a un rol se crean como una fila por cada
# usuario de ese rol (ver core/notificaciones.py), así lo leído queda guardado
# por persona. Quién recibe cada tipo se elige con los permisos "Recibir aviso
# de ..." de la pantalla de permisos.
class Notificacion(models.Model):
    class Tipo(models.TextChoices):
        CUESTIONARIO_ASIGNADO = "cuestionario_asignado", "Cuestionario asignado"
        ENCUESTA_CARGADA = "encuesta_cargada", "Encuesta cargada"
        BACKUP_FALLIDO = "backup_fallido", "Backup fallido"
        CONTRASENA_CAMBIADA = "contrasena_cambiada", "Contraseña cambiada"

    id_notificacion = models.AutoField(primary_key=True)
    # A quién va dirigida
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="documento_usuario",
        related_name="notificaciones",
    )
    tipo = models.CharField(max_length=30, choices=Tipo)
    titulo = models.CharField(max_length=150)
    mensaje = models.TextField()
    # Pantalla a la que lleva al tocarla
    enlace = models.CharField(max_length=200, blank=True, null=True)
    leida = models.BooleanField(default=False)
    leida_en = models.DateTimeField(blank=True, null=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notificaciones"
        verbose_name = "notificación"
        verbose_name_plural = "notificaciones"
        ordering = ["-creada_en"]
        indexes = [models.Index(fields=["usuario", "leida"], name="ix_notificacion_usuario_leida")]
        # Sin ver/crear/editar/borrar: solo los permisos para recibir avisos
        default_permissions = ()
        permissions = [
            ("recibir_encuesta_cargada", "Recibir aviso de encuesta cargada"),
            ("recibir_backup_fallido", "Recibir aviso de backup fallido"),
        ]

    def __str__(self):
        return f"{self.titulo} ({self.usuario_id})"


# Qué avisos quiere recibir cada usuario (Configuración → Notificaciones). Una
# fila por usuario y tipo; si no hay fila, el aviso se recibe.
class PreferenciaNotificacion(models.Model):
    pk = models.CompositePrimaryKey("usuario", "tipo")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        db_column="documento_usuario",
        related_name="preferencias_notificaciones",
    )
    tipo = models.CharField(max_length=30, choices=Notificacion.Tipo)
    recibir = models.BooleanField(default=True)

    class Meta:
        db_table = "preferencias_notificaciones"
        verbose_name = "preferencia de notificación"
        verbose_name_plural = "preferencias de notificaciones"
        default_permissions = ()
