from django.test import Client, TestCase

from .models import Campana, Categoria, Cuestionario, Encuesta, Encuestado, Militante, Opcion, Pregunta, Usuario


class EncuestasTests(TestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(username="adm", email="adm@ejemplo.com", password="clave-segura-123", is_staff=True)
        usuario = Usuario.objects.create_user(username="mili", email="mili@ejemplo.com", password="clave-segura-123")
        self.militante = Militante.objects.create(nombre="Juan", apellido="Pérez", usuario=usuario)
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.login("mili@ejemplo.com")

        c = Cuestionario.objects.create(
            titulo="Barrial", categoria=Categoria.objects.create(nombre="G"), campana=Campana.objects.create(nombre="C")
        )
        self.c = c
        self.p_mult = Pregunta.objects.create(cuestionario=c, orden=1, enunciado="Problema", tipo="opcion_multiple", obligatoria=True)
        self.seg = Opcion.objects.create(pregunta=self.p_mult, orden=1, texto="Seguridad")
        self.sal = Opcion.objects.create(pregunta=self.p_mult, orden=2, texto="Salud")
        self.p_num = Pregunta.objects.create(cuestionario=c, orden=2, enunciado="Personas", tipo="numero")
        self.p_txt = Pregunta.objects.create(cuestionario=c, orden=3, enunciado="Comentarios", tipo="texto")

    def login(self, email):
        self.enviar("post", "/api/auth/login/", {"email": email, "password": "clave-segura-123"})

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)

    def responder(self, documento, opcion, numero="", texto="", **extra):
        return self.enviar("post", f"/api/responder/{self.c.pk}/", {
            "encuestado": {"documento": documento, "nombre": "Ana"},
            "respuestas": [
                {"pregunta": self.p_mult.pk, "opcion": opcion},
                {"pregunta": self.p_num.pk, "texto": numero},
                {"pregunta": self.p_txt.pk, "texto": texto},
            ],
            **extra,
        })

    def test_militante_no_entra_a_la_administracion(self):
        self.assertEqual(self.client.get("/api/cuestionarios/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/cuestionarios/{self.c.pk}/estadisticas/").status_code, 403)
        self.assertEqual(self.client.get("/api/categorias/").status_code, 403)

    def test_lista_y_detalle_para_responder(self):
        Cuestionario.objects.create(titulo="Inactivo", activo=False, categoria=self.c.categoria, campana=self.c.campana)
        lista = self.client.get("/api/responder/").json()["cuestionarios"]
        self.assertEqual([c["titulo"] for c in lista], ["Barrial"])
        detalle = self.client.get(f"/api/responder/{self.c.pk}/").json()["cuestionario"]
        self.assertEqual(len(detalle["preguntas"]), 3)

    def test_responder_guarda_encuesta_con_militante(self):
        r = self.responder("30.123.456", self.seg.pk, "4", "Falta luz", latitud=-24.79, longitud=-65.41)
        self.assertEqual(r.status_code, 201, r.content)
        encuesta = Encuesta.objects.get()
        self.assertEqual(encuesta.militante, self.militante)
        self.assertEqual(encuesta.encuestado.documento, "30123456")
        self.assertEqual(encuesta.respuestas.count(), 3)
        self.assertEqual(float(encuesta.latitud), -24.79)

    def test_no_responde_dos_veces(self):
        self.responder("1", self.seg.pk)
        r = self.responder("1", self.sal.pk)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(Encuesta.objects.count(), 1)

    def test_validaciones(self):
        self.assertIn("documento", self.responder("", self.seg.pk).json()["error"])
        self.assertIn("pregunta 1", self.responder("2", None).json()["error"])
        otra = Opcion.objects.create(pregunta=Pregunta.objects.create(cuestionario=self.c, orden=4, enunciado="x"), orden=1, texto="x")
        self.assertIn("no es válida", self.responder("2", otra.pk).json()["error"])
        self.assertIn("número", self.responder("2", self.seg.pk, numero="muchos").json()["error"])
        self.assertFalse(Encuesta.objects.exists())
        self.assertFalse(Encuestado.objects.exists())

    def test_estadisticas(self):
        self.responder("1", self.seg.pk, "2", "Hola")
        self.responder("2", self.seg.pk, "4")
        self.responder("3", self.sal.pk, "6,5")
        self.enviar("post", "/api/auth/logout/")
        self.login("adm@ejemplo.com")
        e = self.client.get(f"/api/cuestionarios/{self.c.pk}/estadisticas/").json()
        self.assertEqual((e["total_encuestas"], e["militantes"]), (3, 1))
        mult, num, txt = e["preguntas"]
        self.assertEqual([(o["texto"], o["cantidad"], o["porcentaje"]) for o in mult["opciones"]],
                         [("Seguridad", 2, 66.7), ("Salud", 1, 33.3)])
        self.assertEqual(num["numeros"], {"promedio": 4.17, "mediana": 4.0, "minimo": 2.0, "maximo": 6.5})
        self.assertEqual((txt["respondidas"], txt["sin_responder"], txt["textos"]), (1, 2, ["Hola"]))
