from django.test import Client, TestCase

from .models import Campana, Categoria, Cuestionario, Usuario


class CategoriasTests(TestCase):
    def setUp(self):
        Usuario.objects.create_user(username="ana", email="ana@ejemplo.com", password="clave-segura-123", is_staff=True)
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.enviar("post", "/api/auth/login/", {"email": "ana@ejemplo.com", "password": "clave-segura-123"})

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(
            url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )

    def test_requiere_sesion(self):
        self.enviar("post", "/api/auth/logout/")
        self.assertEqual(self.client.get("/api/categorias/").status_code, 401)

    def test_crear_listar_editar_borrar(self):
        r = self.enviar("post", "/api/categorias/", {"nombre": "  Salud ", "descripcion": "Hospitales"})
        self.assertEqual(r.status_code, 201)
        cat = r.json()["categoria"]
        self.assertEqual((cat["nombre"], cat["cuestionarios"]), ("Salud", 0))

        lista = self.client.get("/api/categorias/").json()["categorias"]
        self.assertEqual([c["nombre"] for c in lista], ["Salud"])

        r = self.enviar("patch", f"/api/categorias/{cat['id']}/", {"nombre": "Salud pública", "descripcion": ""})
        self.assertEqual(r.json()["categoria"]["nombre"], "Salud pública")
        self.assertEqual(r.json()["categoria"]["descripcion"], "")

        self.assertEqual(self.enviar("delete", f"/api/categorias/{cat['id']}/").status_code, 200)
        self.assertFalse(Categoria.objects.exists())

    def test_nombre_obligatorio_y_unico(self):
        self.assertEqual(self.enviar("post", "/api/categorias/", {"nombre": "  "}).status_code, 400)
        self.enviar("post", "/api/categorias/", {"nombre": "Seguridad"})
        r = self.enviar("post", "/api/categorias/", {"nombre": "seguridad"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("Ya existe", r.json()["error"])

    def test_no_borra_categoria_en_uso(self):
        categoria = Categoria.objects.create(nombre="Educación")
        Cuestionario.objects.create(titulo="Escuelas", categoria=categoria, campana=Campana.objects.create(nombre="C"))
        r = self.enviar("delete", f"/api/categorias/{categoria.pk}/")
        self.assertEqual(r.status_code, 409)
        self.assertTrue(Categoria.objects.filter(pk=categoria.pk).exists())

    def test_inexistente(self):
        self.assertEqual(self.enviar("delete", "/api/categorias/999/").status_code, 404)
