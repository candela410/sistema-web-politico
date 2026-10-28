import re

from django.conf import settings
from django.contrib.auth.models import AbstractUser, Permission
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

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
    fecha_inicio = models.DateField(blank=True, null=True)
    fecha_fin = models.DateField(blank=True, null=True)
    activa = models.BooleanField(default=True)
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "campanas"
        verbose_name = "campaña"
        verbose_name_plural = "campañas"
        ordering = ["-activa", "nombre"]
        # Permisos propios (tabla auth_permission). "administrar_campana" incluye
        # todo lo de la campaña: mapa, cuestionarios, categorías, usuarios,
        # permisos (ver) y actividad. Ver core/api.py.
        permissions = [
            ("elegir_campana", "Puede elegir la campaña al ingresar"),
            ("administrar_campana", "Puede administrar la campaña"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(fecha_inicio__isnull=True)
                    | Q(fecha_fin__isnull=True)
                    | Q(fecha_fin__gte=F("fecha_inicio"))
                ),
                name="ck_campana_fechas",
            )
        ]

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
    id_ruta = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True, null=True)
    campana = models.ForeignKey(
        Campana,
        on_delete=models.PROTECT,
        db_column="id_campana",
        related_name="rutas",
    )
    zona = models.ForeignKey(
        Zona,
        on_delete=models.PROTECT,
        db_column="id_zona",
        null=True,
        blank=True,
        related_name="rutas",
    )
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
        constraints = [
            models.UniqueConstraint(
                fields=["campana", "nombre"],
                name="uq_ruta_campana_nombre",
            )
        ]

    def __str__(self):
        return self.nombre


class Equipo(models.Model):
    id_equipo = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120)
    descripcion = models.TextField(blank=True, null=True)
    campana = models.ForeignKey(
        Campana,
        on_delete=models.PROTECT,
        db_column="id_campana",
        related_name="equipos",
    )
    ruta = models.ForeignKey(
        Ruta,
        on_delete=models.SET_NULL,
        db_column="id_ruta",
        null=True,
        blank=True,
        related_name="equipos",
    )

    class Meta:
        db_table = "equipos"
        verbose_name = "equipo"
        constraints = [
            models.UniqueConstraint(
                fields=["campana", "nombre"],
                name="uq_equipo_campana_nombre",
            )
        ]

    def __str__(self):
        return self.nombre


# ---------------------------------------------------------------------------
# Personas
# ---------------------------------------------------------------------------


# Usuario del sistema: reemplaza a auth_user. Los grupos y permisos
# son los de Django (auth_group, auth_permission, auth_group_permissions).
class Usuario(AbstractUser):
    # Único porque el login es con correo y contraseña
    email = models.EmailField(unique=True)

    campana = models.ForeignKey(
        Campana,
        on_delete=models.PROTECT,
        db_column="id_campana",
        null=True,
        blank=True,
        related_name="usuarios",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "usuarios"
        verbose_name = "usuario"


class Militante(models.Model):
    id_militante = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    documento = models.CharField(max_length=30, unique=True, null=True, blank=True)
    telefono = models.CharField(max_length=40, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        db_column="id_usuario",
        null=True,
        blank=True,
        related_name="militante",
    )
    equipo = models.ForeignKey(
        Equipo,
        on_delete=models.SET_NULL,
        db_column="id_equipo",
        null=True,
        blank=True,
        related_name="militantes",
    )

    class Meta:
        db_table = "militantes"
        verbose_name = "militante"
        ordering = ["apellido", "nombre"]

    def __str__(self):
        return f"{self.nombre} {self.apellido}"


class Encuestado(models.Model):
    id_encuestado = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, blank=True, null=True)
    apellido = models.CharField(max_length=100, blank=True, null=True)
    # Único: identifica a la persona. Que responda una sola vez cada
    # cuestionario lo controla Encuesta (uq_encuesta_encuestado_cuestionario).
    documento = models.CharField(max_length=30, unique=True)
    telefono = models.CharField(max_length=40, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)

    calle = models.ForeignKey(
        Calle,
        on_delete=models.SET_NULL,
        db_column="id_calle",
        null=True,
        blank=True,
        related_name="encuestados",
    )
    barrio = models.ForeignKey(
        Barrio,
        on_delete=models.SET_NULL,
        db_column="id_barrio",
        null=True,
        blank=True,
        related_name="encuestados",
    )
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

    campana = models.ForeignKey(
        Campana,
        on_delete=models.PROTECT,
        db_column="id_campana",
        related_name="cuestionarios",
    )
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        db_column="id_categoria",
        related_name="cuestionarios",
    )

    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    militantes = models.ManyToManyField(
        Militante,
        through="AsignacionCuestionario",
        related_name="cuestionarios",
    )

    class Meta:
        db_table = "cuestionarios"
        verbose_name = "cuestionario"

    def __str__(self):
        return self.titulo


class AsignacionCuestionario(models.Model):
    militante = models.ForeignKey(
        Militante,
        on_delete=models.PROTECT,
        db_column="id_militante",
    )
    cuestionario = models.ForeignKey(
        Cuestionario,
        on_delete=models.PROTECT,
        db_column="id_cuestionario",
    )
    asignado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "militantexcuestionarios"
        verbose_name = "asignación de cuestionario"
        constraints = [
            models.UniqueConstraint(
                fields=["militante", "cuestionario"],
                name="uq_militante_cuestionario",
            )
        ]


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


# Una visita: un militante le toma un cuestionario a un encuestado.
# Guarda quién cargó la encuesta, cuándo y dónde (para el mapa).
class Encuesta(models.Model):
    id_encuesta = models.AutoField(primary_key=True)
    encuestado = models.ForeignKey(
        Encuestado,
        on_delete=models.PROTECT,
        db_column="id_encuestado",
        related_name="encuestas",
    )
    cuestionario = models.ForeignKey(
        Cuestionario,
        on_delete=models.PROTECT,
        db_column="id_cuestionario",
        related_name="encuestas",
    )
    militante = models.ForeignKey(
        Militante,
        on_delete=models.PROTECT,
        db_column="id_militante",
        null=True,
        blank=True,
        related_name="encuestas",
    )
    latitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitud = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    realizada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "encuestas"
        verbose_name = "encuesta"
        constraints = [
            # Una persona responde una sola vez cada cuestionario
            models.UniqueConstraint(
                fields=["encuestado", "cuestionario"],
                name="uq_encuesta_encuestado_cuestionario",
            )
        ]

    def __str__(self):
        return f"{self.encuestado} - {self.cuestionario}"


class RespuestaCargada(models.Model):
    id_respuesta = models.AutoField(primary_key=True)

    # PROTECT: borrar datos relacionados nunca elimina respuestas cargadas
    encuesta = models.ForeignKey(
        Encuesta,
        on_delete=models.PROTECT,
        db_column="id_encuesta",
        related_name="respuestas",
    )
    pregunta = models.ForeignKey(
        Pregunta,
        on_delete=models.PROTECT,
        db_column="id_pregunta",
        related_name="respuestas",
    )
    # En "opción múltiple" una pregunta tiene una fila por cada opción elegida
    opcion = models.ForeignKey(
        Opcion,
        on_delete=models.PROTECT,
        db_column="id_opcion",
        related_name="respuestas",
    )
    cargada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "respuesta_cargada"
        verbose_name = "respuesta cargada"
        verbose_name_plural = "respuestas cargadas"
        constraints = [
            models.UniqueConstraint(
                fields=["encuesta", "opcion"],
                name="uq_respuesta_encuesta_opcion",
            ),
        ]

    def clean(self):
        # Reglas que cruzan tablas y no se pueden expresar como CheckConstraint
        if self.pregunta_id and self.encuesta_id:
            if self.pregunta.cuestionario_id != self.encuesta.cuestionario_id:
                raise ValidationError("La pregunta no pertenece al cuestionario de la encuesta.")
        if self.opcion_id and self.pregunta_id:
            if self.opcion.pregunta_id != self.pregunta_id:
                raise ValidationError("La opción elegida no pertenece a esa pregunta.")


# ---------------------------------------------------------------------------
# Grupos
# ---------------------------------------------------------------------------


class Grupo(models.Model):
    id_grupo = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=120, unique=True)
    descripcion = models.TextField(blank=True, default="")
    # Permisos de Django (tabla auth_permission) que tiene el grupo
    permisos = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="grupos_core",
        db_table="grupos_permisos",
    )

    class Meta:
        db_table = "grupos"
        ordering = ["nombre"]
        verbose_name = "grupo"

    def __str__(self):
        return self.nombre