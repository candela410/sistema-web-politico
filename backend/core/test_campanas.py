from django.contrib.auth.models import Group, Permission
from django.test import Client, TestCase

from .models import Campana, Categoria, Cuestionario, Usuario, Zona

CLAVE = "clave-segura-123"


class Base(TestCase):
    def setUp(self):
        self.norte = Campana.objects.create(nombre="Campaña Norte")
        self.sur = Campana.objects.create(nombre="Campaña Sur")
        self.jefe = Usuario.objects.create_superuser(username="jefe", email="jefe@ejemplo.com", password=CLAVE)
        self.coordinadora = Usuario.objects.create_user(
            username="coord", email="coord@ejemplo.com", password=CLAVE, first_name="Coordinadora", campana=self.norte
        )
        self.coordinadora.user_permissions.add(Permission.objects.get(codename="administrar_campana"))
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)

    def entrar(self, email, campana=None):
        r = self.enviar("post", "/api/auth/login/", {"email": email, "password": CLAVE})
        if campana:
            r = self.enviar("post", "/api/campanas/activa/", {"campana": campana.pk})
        return r.json()["usuario"]


class CampanasTests(Base):
    def test_superusuario_elige_campana(self):
        usuario = self.entrar("jefe@ejemplo.com")
        self.assertTrue(usuario["puede_elegir_campana"])
        self.assertIsNone(usuario["campana"])
        # Sin campaña elegida no se ve nada de la campaña
        r = self.client.get("/api/cuestionarios/")
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "sin_campana"))
        disponibles = self.client.get("/api/campanas/disponibles/").json()["campanas"]
        self.assertEqual([c["nombre"] for c in disponibles], ["Campaña Norte", "Campaña Sur"])
        usuario = self.enviar("post", "/api/campanas/activa/", {"campana": self.sur.pk}).json()["usuario"]
        self.assertEqual(usuario["campana"]["nombre"], "Campaña Sur")
        self.assertEqual(self.client.get("/api/cuestionarios/").status_code, 200)

    def test_coordinadora_trabaja_en_su_campana_y_no_elige(self):
        usuario = self.entrar("coord@ejemplo.com")
        self.assertFalse(usuario["puede_elegir_campana"])
        self.assertEqual(usuario["campana"]["nombre"], "Campaña Norte")
        self.assertEqual(self.enviar("post", "/api/campanas/activa/", {"campana": self.sur.pk}).status_code, 403)
        self.assertEqual(self.client.get("/api/campanas/").status_code, 403)

    def test_los_datos_se_separan_por_campana(self):
        cat = Categoria.objects.create(nombre="General")
        Cuestionario.objects.create(titulo="Del norte", categoria=cat, campana=self.norte)
        Cuestionario.objects.create(titulo="Del sur", categoria=cat, campana=self.sur)
        Zona.objects.create(nombre="Zona compartida")
        self.entrar("jefe@ejemplo.com", self.sur)
        self.assertEqual([c["titulo"] for c in self.client.get("/api/cuestionarios/").json()["cuestionarios"]], ["Del sur"])
        # Las zonas son territorio compartido: se ven desde cualquier campaña
        self.assertEqual([z["nombre"] for z in self.client.get("/api/mapa/zonas/").json()["zonas"]], ["Zona compartida"])
        otro = Cuestionario.objects.get(titulo="Del norte")
        self.assertEqual(self.client.get(f"/api/cuestionarios/{otro.pk}/").status_code, 404)

    def test_crud_de_campanas(self):
        self.entrar("jefe@ejemplo.com")
        r = self.enviar("post", "/api/campanas/", {"nombre": "Elecciones 2027", "fecha_inicio": "2027-01-01", "fecha_fin": "2026-01-01"})
        self.assertIn("fecha de fin", r.json()["error"])
        r = self.enviar("post", "/api/campanas/", {"nombre": "Elecciones 2027", "fecha_inicio": "2027-01-01"})
        self.assertEqual(r.status_code, 201, r.content)
        nueva = r.json()["campana"]["id"]
        r = self.enviar("patch", f"/api/campanas/{nueva}/", {"activa": False})
        self.assertFalse(r.json()["campana"]["activa"])
        # Con datos no se borra
        self.assertEqual(self.enviar("delete", f"/api/campanas/{self.norte.pk}/").status_code, 409)
        self.assertEqual(self.enviar("delete", f"/api/campanas/{nueva}/").status_code, 200)


class UsuariosTests(Base):
    def setUp(self):
        super().setUp()
        self.militantes = Group.objects.get(name="Militantes")
        self.entrar("coord@ejemplo.com")

    def test_crear_militante_en_la_campana(self):
        r = self.enviar("post", "/api/usuarios/", {
            "email": "Nuevo@Ejemplo.com", "nombre": "Pedro", "apellido": "Gómez", "password": "otra-clave-larga-9",
            "grupos": [self.militantes.pk], "documento": "30.111.222", "telefono": "387",
        })
        self.assertEqual(r.status_code, 201, r.content)
        u = Usuario.objects.get(email="nuevo@ejemplo.com")
        self.assertEqual(u.campana, self.norte)
        self.assertEqual((u.documento, u.telefono), ("30111222", "387"))
        # El nuevo usuario entra y solo puede cargar encuestas
        self.enviar("post", "/api/auth/logout/")
        r = self.enviar("post", "/api/auth/login/", {"email": "nuevo@ejemplo.com", "password": "otra-clave-larga-9"})
        usuario = r.json()["usuario"]
        self.assertIn("core.add_encuesta", usuario["permisos"])
        self.assertEqual(self.client.get("/api/responder/").status_code, 200)
        self.assertEqual(self.client.get("/api/usuarios/").status_code, 403)

    def test_validaciones(self):
        casos = [
            ({"email": "malo", "nombre": "A", "password": "otra-clave-larga-9", "grupos": [self.militantes.pk]}, "email"),
            ({"email": "coord@ejemplo.com", "nombre": "A", "password": "otra-clave-larga-9", "grupos": [self.militantes.pk]}, "Ya existe"),
            ({"email": "x@ejemplo.com", "nombre": "A", "password": "123", "grupos": [self.militantes.pk]}, "contraseña"),
            ({"email": "x@ejemplo.com", "nombre": "A", "password": "otra-clave-larga-9", "grupos": []}, "Elegí qué puede hacer"),
        ]
        for datos, texto in casos:
            r = self.enviar("post", "/api/usuarios/", datos)
            self.assertEqual(r.status_code, 400, datos)
            self.assertIn(texto, r.json()["error"], datos)

    def test_solo_ve_usuarios_de_su_campana_y_desactiva(self):
        otro = Usuario.objects.create_user(username="sur", email="sur@ejemplo.com", password=CLAVE, campana=self.sur)
        emails = [u["email"] for u in self.client.get("/api/usuarios/").json()["usuarios"]]
        self.assertEqual(emails, ["coord@ejemplo.com"])
        self.assertEqual(self.enviar("delete", f"/api/usuarios/{otro.pk}/").status_code, 404)
        self.assertEqual(self.enviar("delete", f"/api/usuarios/{self.coordinadora.pk}/").status_code, 409)

    def test_administrar_se_da_como_permiso(self):
        r = self.enviar("post", "/api/usuarios/", {
            "email": "jefa2@ejemplo.com", "nombre": "Sol", "password": "otra-clave-larga-9", "grupos": [], "administra": True,
        })
        self.assertEqual(r.status_code, 201, r.content)
        u = Usuario.objects.get(email="jefa2@ejemplo.com")
        self.assertTrue(u.has_perm("core.administrar_campana"))
        self.assertFalse(u.groups.exists())
        self.assertTrue(r.json()["usuario"]["administra"])

    def test_permisos_solo_lectura(self):
        datos = self.client.get("/api/permisos/").json()
        self.assertEqual([g["nombre"] for g in datos["grupos"]], ["Militantes"])
        self.assertIn("Puede administrar la campaña", [p["nombre"] for p in datos["propios"]])
        grupos = {g["nombre"]: g for g in datos["grupos"]}
        militantes = {p["seccion"]: p["acciones"] for p in grupos["Militantes"]["permisos"]}
        self.assertEqual(militantes, {"Encuestas": ["Crear"]})
        self.assertEqual(self.enviar("post", "/api/permisos/", {}).status_code, 405)


class HistorialTests(Base):
    def test_registra_cambios_con_valor_anterior_y_nuevo(self):
        self.entrar("coord@ejemplo.com")
        cat = self.enviar("post", "/api/categorias/", {"nombre": "Salud"}).json()["categoria"]
        self.enviar("patch", f"/api/categorias/{cat['id']}/", {"nombre": "Salud pública", "descripcion": "Hospitales"})
        self.enviar("delete", f"/api/categorias/{cat['id']}/")

        datos = self.client.get("/api/historial/").json()
        movimientos = datos["movimientos"]
        self.assertEqual([m["accion"] for m in movimientos], ["borrar", "editar", "crear", "sesion"])
        editar = movimientos[1]
        self.assertEqual(editar["usuario"]["email"], "coord@ejemplo.com")
        self.assertEqual(editar["seccion"], "Categoría")
        self.assertEqual(editar["cambios"], [
            {"campo": "Nombre", "antes": "Salud", "despues": "Salud pública"},
            {"campo": "Descripción", "antes": "", "despues": "Hospitales"},
        ])
        # Filtros
        solo = self.client.get("/api/historial/?accion=editar").json()["movimientos"]
        self.assertEqual(len(solo), 1)

    def test_cada_campana_ve_su_historial(self):
        self.entrar("jefe@ejemplo.com", self.sur)
        self.enviar("post", "/api/categorias/", {"nombre": "En el sur"})
        self.enviar("post", "/api/auth/logout/")
        self.entrar("coord@ejemplo.com")
        objetos = [m["objeto"] for m in self.client.get("/api/historial/").json()["movimientos"]]
        self.assertNotIn("En el sur", objetos)
