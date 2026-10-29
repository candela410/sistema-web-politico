import re

from django.conf import settings
from django.contrib.auth.models import AbstractUser, Permission
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

def con_mayuscula(texto):
    """Primera letra en mayúscula, el resto como se escribió ("barrio norte" → "Barrio norte")."""
    if not isinstance(texto, str):
        return texto
    texto = texto.strip()
    return texto[:1].upper() + texto[1:]


# Campos que se guardan siempre con la primera letra en mayúscula: todo
# "nombre" y, en usuarios, el nombre y el apellido. Ver CoreConfig.ready().
CAMPOS_NOMBRE = ("nombre", "first_name", "last_name")


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
    # Rol del usuario (tabla grupos, como en el DER): un usuario tiene un solo
    # grupo y un grupo muchos usuarios. Los permisos se siguen tomando del
    # auth.Group de ese grupo (usuarios_groups), que se mantiene igual a este.
    grupo = models.ForeignKey(
        "Grupo",
        on_delete=models.SET_NULL,
        db_column="id_grupo",
        null=True,
        blank=True,
        related_name="usuarios",
    )

    # Datos de la persona (antes estaban en la tabla militantes)
    documento = models.CharField(max_length=30, unique=True, null=True, blank=True)
    telefono = models.CharField(max_length=40, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    equipo = models.ForeignKey(
        Equipo,
        on_delete=models.SET_NULL,
        db_column="id_equipo",
        null=True,
        blank=True,
        related_name="usuarios",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        db_table = "usuarios"
        verbose_name = "usuario"


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
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="id_usuario",
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
        constraints = [
            models.UniqueConstraint(
                fields=["usuario", "cuestionario"],
                name="uq_usuario_cuestionario",
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


# Una visita: un usuario (militante) le toma un cuestionario a un encuestado.
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
    # Quién cargó la encuesta
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column="id_usuario",
        null=True,
        blank=True,
        related_name="encuestas_cargadas",
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
    # Ficha de un grupo de Django (auth.Group): guarda lo que auth.Group no
    # tiene (la descripción). Los usuarios y los permisos de verdad viven en
    # auth.Group (user.groups y group.permissions), los mismos que usa
    # Gestión → Usuarios. Ver grupos_views.py.
    id_grupo = models.AutoField(primary_key=True)
    group = models.OneToOneField(
        "auth.Group",
        on_delete=models.CASCADE,
        db_column="id_group",
        null=True,
        blank=True,
        related_name="ficha",
    )
    nombre = models.CharField(max_length=120, unique=True)
    descripcion = models.TextField(blank=True, default="")
    # En desuso: los permisos del grupo son los de auth.Group.permissions.
    # Se conserva para no perder lo cargado antes (lo copia la migración 0010).
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