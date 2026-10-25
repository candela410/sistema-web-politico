from django.test import Client, TestCase

from .models import Usuario


class LoginTests(TestCase):
    def setUp(self):
        Usuario.objects.create_user(
            username="ana", email="ana@ejemplo.com", password="clave-segura-123"
        )
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")

    def post(self, url, datos=None):
        # El login rota el token CSRF: se lee siempre la cookie actual,
        # igual que hace el frontend.
        csrf = self.client.cookies["csrftoken"].value
        return self.client.post(
            url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )

    def test_login_correcto_crea_sesion(self):
        r = self.post("/api/auth/login/", {"email": "ana@ejemplo.com", "password": "clave-segura-123"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["usuario"]["email"], "ana@ejemplo.com")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_contrasena_incorrecta(self):
        r = self.post("/api/auth/login/", {"email": "ana@ejemplo.com", "password": "mal"})
        self.assertEqual(r.status_code, 401)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_sin_csrf_se_rechaza(self):
        r = self.client.post(
            "/api/auth/login/",
            {"email": "ana@ejemplo.com", "password": "clave-segura-123"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 403)

    def test_logout_cierra_sesion(self):
        self.post("/api/auth/login/", {"email": "ana@ejemplo.com", "password": "clave-segura-123"})
        self.post("/api/auth/logout/")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
