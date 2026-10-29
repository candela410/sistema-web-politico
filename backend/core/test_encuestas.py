from django.contrib.auth.models import Group
from django.test import Client, TestCase

from .models import (
    AsignacionCuestionario, Campana, Categoria, Cuestionario, Encuesta, Encuestado, Opcion, Pregunta, RespuestaCargada, Usuario,
)


class EncuestasTests(TestCase):
    def setUp(self):
        self.campana = Campana.objects.create(nombre="C")
        Usuario.objects.create_superuser(username="adm", email="adm@ejemplo.com", password="clave-segura-123")
        usuario = Usuario.objects.create_user(
            username="mili", email="mili@ejemplo.com", password="clave-segura-123", campana=self.campana
        )
        usuario.groups.add(Group.objects.get(name="Militantes"))
        self.militante = usuario
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.login("mili@ejemplo.com")

        self.c = Cuestionario.objects.create(
            titulo="Barrial", categoria=Categoria.objects.create(nombre="G"), campana=self.campana
        )
        # El militante solo ve y responde los cuestionarios que tiene asignados
        AsignacionCuestionario.objects.create(usuario=usuario, cuestionario=self.c)
        # Una sola opción, cualitativa
        self.p_una = self.pregunta(1, "Problema", "una_opcion", ["Seguridad", "Salud"], obligatoria=True)
        # Una sola opción, cualitativa y no obligatoria
        self.p_mult = self.pregunta(2, "Medios", "una_opcion", ["Radio", "TV", "Redes"])
        # Una sola opción, cuantitativa
        self.p_num = self.pregunta(3, "Personas en la casa", "una_opcion", ["1", "2", "3", "4"])

    def pregunta(self, orden, enunciado, tipo, opciones, obligatoria=False):
        p = Pregunta.objects.create(
            cuestionario=self.c, orden=orden, enunciado=enunciado, tipo=tipo, obligatoria=obligatoria
        )
        p.ops = {t: Opcion.objects.create(pregunta=p, orden=i, texto=t).pk for i, t in enumerate(opciones, 1)}
        return p

    def login(self, email):
        self.enviar("post", "/api/auth/login/", {"email": email, "password": "clave-segura-123"})
        if email.startswith("adm"):
            self.enviar("post", "/api/campanas/activa/", {"campana": self.campana.pk})

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)

    def responder(self, documento, una=None, medios=(), personas=None, **extra):
        respuestas = [
            {"pregunta": self.p_una.pk, "opciones": [self.p_una.ops[una]] if una else []},
            {"pregunta": self.p_mult.pk, "opciones": [self.p_mult.ops[m] for m in medios]},
            {"pregunta": self.p_num.pk, "opciones": [self.p_num.ops[personas]] if personas else []},
        ]
        return self.enviar("post", f"/api/responder/{self.c.pk}/", {
            "encuestado": {"documento": documento, "nombre": "Ana"}, "respuestas": respuestas, **extra,
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
        self.assertEqual([p["tipo"] for p in detalle["preguntas"]], ["una_opcion", "una_opcion", "una_opcion"])

    def test_no_ve_ni_responde_cuestionarios_sin_asignar(self):
        otro = Cuestionario.objects.create(titulo="Sin asignar", categoria=self.c.categoria, campana=self.campana)
        lista = self.client.get("/api/responder/").json()["cuestionarios"]
        self.assertNotIn("Sin asignar", [c["titulo"] for c in lista])
        self.assertEqual(self.client.get(f"/api/responder/{otro.pk}/").status_code, 404)

    def test_responder_guarda_encuesta_con_militante(self):
        r = self.responder("30.123.456", "Seguridad", ["Radio"], "4", latitud=-24.79, longitud=-65.41)
        self.assertEqual(r.status_code, 201, r.content)
        encuesta = Encuesta.objects.get()
        self.assertEqual(encuesta.usuario, self.militante)
        self.assertEqual(encuesta.encuestado.documento, "30123456")
        self.assertEqual(RespuestaCargada.objects.count(), 3)  # una por pregunta
        self.assertEqual(float(encuesta.latitud), -24.79)

    def test_no_responde_dos_veces(self):
        self.responder("1", "Seguridad")
        r = self.responder("1", "Salud")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(Encuesta.objects.count(), 1)

    def test_validaciones(self):
        self.assertIn("documento", self.responder("", "Seguridad").json()["error"])
        self.assertIn("pregunta 1", self.responder("2").json()["error"])
        r = self.enviar("post", f"/api/responder/{self.c.pk}/", {
            "encuestado": {"documento": "2"},
            "respuestas": [{"pregunta": self.p_una.pk, "opciones": list(self.p_una.ops.values())}],
        })
        self.assertIn("una sola opción", r.json()["error"])
        r = self.enviar("post", f"/api/responder/{self.c.pk}/", {
            "encuestado": {"documento": "2"},
            "respuestas": [{"pregunta": self.p_una.pk, "opciones": [self.p_mult.ops["TV"]]}],
        })
        self.assertIn("no es válida", r.json()["error"])
        self.assertFalse(Encuesta.objects.exists())
        self.assertFalse(Encuestado.objects.exists())

    def test_estadisticas(self):
        self.responder("1", "Seguridad", ["Radio"], "2")
        self.responder("2", "Seguridad", ["Radio"], "4")
        self.responder("3", "Salud", [], "4")
        self.enviar("post", "/api/auth/logout/")
        self.login("adm@ejemplo.com")
        e = self.client.get(f"/api/cuestionarios/{self.c.pk}/estadisticas/").json()
        self.assertEqual((e["total_encuestas"], e["militantes"]), (3, 1))
        una, mult, num = e["preguntas"]

        self.assertEqual(una["variable"], "cualitativa")
        self.assertEqual([(o["texto"], o["cantidad"], o["porcentaje"]) for o in una["opciones"]],
                         [("Seguridad", 2, 66.7), ("Salud", 1, 33.3)])
        # Pregunta no obligatoria: porcentaje sobre las personas que respondieron (2)
        self.assertEqual((mult["respondidas"], mult["sin_responder"], mult["elecciones"]), (2, 1, 2))
        self.assertEqual([(o["texto"], o["porcentaje"]) for o in mult["opciones"]],
                         [("Radio", 100.0), ("TV", 0.0), ("Redes", 0.0)])

        self.assertEqual(num["variable"], "cuantitativa")
        self.assertEqual([o["valor"] for o in num["opciones"]], [1, 2, 3, 4])
        self.assertEqual(num["medidas"], {
            "n": 3, "media": 3.33, "mediana": 4, "moda": [4.0], "desvio": 1.15,
            "minimo": 2.0, "maximo": 4.0, "rango": 2.0,
        })

        # Gráficos: imágenes PNG hechas con pandas y matplotlib
        for clave in ("barras", "columnas", "linea", "torta", "distribucion"):
            r = self.client.get(f"/api/cuestionarios/{self.c.pk}/estadisticas/{una['id']}/{clave}.png")
            self.assertEqual((r.status_code, r["Content-Type"]), (200, "image/png"), clave)
            self.assertTrue(r.content.startswith(b"\x89PNG"), clave)
        r = self.client.get(f"/api/cuestionarios/{self.c.pk}/estadisticas/{una['id']}/otro.png")
        self.assertEqual(r.status_code, 404)
