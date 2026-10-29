from django.test import Client, TestCase

from .models import Campana, Categoria, Cuestionario, Encuestado, Encuesta, Opcion, Pregunta, Usuario

FORMULARIO = {
    "titulo": "Encuesta barrial",
    "descripcion": "Relevamiento de necesidades",
    "activo": True,
    "preguntas": [
        {"enunciado": "¿Qué problema es más urgente?", "tipo": "una_opcion", "obligatoria": True,
         "opciones": [{"texto": "Seguridad"}, {"texto": "Salud"}, {"texto": "Trabajo"}]},
        {"enunciado": "¿Qué medio usa para informarse?", "tipo": "una_opcion",
         "opciones": [{"texto": "Radio"}, {"texto": "TV"}, {"texto": "Redes"}]},
        {"enunciado": "¿Cuántas personas viven en la casa?", "tipo": "una_opcion",
         "opciones": [{"texto": "1"}, {"texto": "2"}, {"texto": "3"}, {"texto": "4,5"}]},
    ],
}


class CuestionariosTests(TestCase):
    def setUp(self):
        self.campana = Campana.objects.create(nombre="Campaña de prueba")
        Usuario.objects.create_superuser(username="ana", email="ana@ejemplo.com", password="clave-segura-123")
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.enviar("post", "/api/auth/login/", {"email": "ana@ejemplo.com", "password": "clave-segura-123"})
        self.enviar("post", "/api/campanas/activa/", {"campana": self.campana.pk})
        self.categoria = Categoria.objects.create(nombre="General")

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(
            url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )

    def crear(self, **cambios):
        return self.enviar("post", "/api/cuestionarios/", {**FORMULARIO, "categoria": self.categoria.pk, **cambios})

    def test_requiere_sesion(self):
        self.enviar("post", "/api/auth/logout/")
        self.assertEqual(self.client.get("/api/cuestionarios/").status_code, 401)

    def test_crear_completo(self):
        r = self.crear()
        self.assertEqual(r.status_code, 201, r.content)
        c = r.json()["cuestionario"]
        self.assertEqual([p["tipo"] for p in c["preguntas"]], ["una_opcion", "una_opcion", "una_opcion"])
        # Opciones con texto: cualitativa. Todas números: cuantitativa
        self.assertEqual([p["variable"] for p in c["preguntas"]], ["cualitativa", "cualitativa", "cuantitativa"])
        self.assertEqual([o["texto"] for o in c["preguntas"][0]["opciones"]], ["Seguridad", "Salud", "Trabajo"])
        self.assertTrue(c["preguntas"][0]["obligatoria"])
        self.assertEqual(list(Pregunta.objects.values_list("orden", flat=True)), [1, 2, 3])

        lista = self.client.get("/api/cuestionarios/").json()["cuestionarios"]
        self.assertEqual((lista[0]["preguntas"], lista[0]["categoria"]["nombre"]), (3, "General"))

    def test_validaciones(self):
        casos = [
            ({"titulo": " "}, "título"),
            ({"categoria": None}, "categoría"),
            ({"preguntas": []}, "al menos una pregunta"),
            ({"preguntas": [{"enunciado": "", "tipo": "una_opcion"}]}, "pregunta 1"),
            ({"preguntas": [{"enunciado": "A", "tipo": "texto", "opciones": ["x", "y"]}]}, "tipo"),
            ({"preguntas": [{"enunciado": "A", "tipo": "una_opcion", "opciones": []}]}, "2 opciones"),
            ({"preguntas": [{"enunciado": "A", "tipo": "una_opcion", "opciones": [{"texto": "Uno"}]}]}, "2 opciones"),
            ({"preguntas": [{"enunciado": "A", "tipo": "opcion_multiple", "opciones": ["x", "y"]}]}, "una sola opción"),
            ({"preguntas": [{"enunciado": "A", "tipo": "una_opcion", "opciones": ["Sí", "sí"]}]}, "repetidas"),
        ]
        for cambios, texto in casos:
            r = self.crear(**cambios)
            self.assertEqual(r.status_code, 400, cambios)
            self.assertIn(texto, r.json()["error"], cambios)
        self.assertFalse(Cuestionario.objects.exists())

    def test_editar_reemplaza_preguntas(self):
        c = self.crear().json()["cuestionario"]
        nuevo = {**FORMULARIO, "categoria": self.categoria.pk, "titulo": "Otra",
                 "preguntas": [{"enunciado": "Única", "tipo": "una_opcion", "opciones": ["Sí", "No"]}]}
        r = self.enviar("put", f"/api/cuestionarios/{c['id']}/", nuevo)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["cuestionario"]["titulo"], "Otra")
        self.assertEqual(Pregunta.objects.count(), 1)
        self.assertEqual(Opcion.objects.count(), 2)

    def test_con_encuestas_solo_cambia_cabecera(self):
        c = self.crear().json()["cuestionario"]
        Encuesta.objects.create(encuestado=Encuestado.objects.create(documento="1"), cuestionario_id=c["id"])
        r = self.enviar("put", f"/api/cuestionarios/{c['id']}/",
                        {**FORMULARIO, "categoria": self.categoria.pk, "titulo": "Renombrado", "preguntas": []})
        self.assertEqual(r.status_code, 200, r.content)
        detalle = r.json()["cuestionario"]
        self.assertTrue(detalle["bloqueado"])
        self.assertEqual((detalle["titulo"], len(detalle["preguntas"])), ("Renombrado", 3))
        self.assertEqual(self.enviar("delete", f"/api/cuestionarios/{c['id']}/").status_code, 409)

    def test_borrar(self):
        c = self.crear().json()["cuestionario"]
        self.assertEqual(self.enviar("delete", f"/api/cuestionarios/{c['id']}/").status_code, 200)
        self.assertFalse(Pregunta.objects.exists())
