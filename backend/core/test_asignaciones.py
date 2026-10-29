from django.contrib.auth.models import Group
from django.test import Client, TestCase

from .models import AsignacionCuestionario, Campana, Categoria, Cuestionario, Encuesta, Equipo, Ruta, Usuario


class AsignacionesTests(TestCase):
    def setUp(self):
        self.campana = Campana.objects.create(nombre="C")
        self.otra = Campana.objects.create(nombre="Otra")
        self.militantes = Group.objects.get(name="Militantes")
        Usuario.objects.create_superuser(username="adm", email="adm@x.com", password="clave-segura-123")
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.enviar("post", "/api/auth/login/", {"email": "adm@x.com", "password": "clave-segura-123"})
        self.enviar("post", "/api/campanas/activa/", {"campana": self.campana.pk})
        self.c = Cuestionario.objects.create(
            titulo="Barrial", categoria=Categoria.objects.create(nombre="G")
        )
        self.url = f"/api/cuestionarios/{self.c.pk}/asignaciones/"
        self.ruta = Ruta.objects.create(nombre="R", paradas=[])
        self.norte = Equipo.objects.create(nombre="Norte", ruta=self.ruta)

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)

    def militante(self, email, equipo=None, campana=None, activo=True, rol=True):
        u = Usuario.objects.create_user(
            username=email, email=email, password="clave-segura-123", first_name=email.split("@")[0],
            campana=campana or self.campana, equipo=equipo, is_active=activo,
        )
        if rol:
            u.groups.add(self.militantes)
        return u

    def asignar(self, *usuarios):
        return self.enviar("put", self.url, {"usuarios": [u.pk for u in usuarios]})

    def asignados(self):
        return set(AsignacionCuestionario.objects.filter(cuestionario=self.c).values_list("usuario__email", flat=True))

    def test_lista_equipos_con_sus_militantes_y_sin_equipo(self):
        self.militante("ana@x.com", equipo=self.norte)
        self.militante("beto@x.com")
        self.militante("inactivo@x.com", activo=False)
        self.militante("ajeno@x.com", campana=self.otra)
        self.militante("coordinador@x.com", rol=False)
        Equipo.objects.create(nombre="Vacío", ruta=self.ruta)
        datos = self.client.get(self.url).json()
        self.assertEqual(datos["cuestionario"]["titulo"], "Barrial")
        self.assertEqual([e["nombre"] for e in datos["equipos"]], ["Norte"])
        self.assertEqual([u["email"] for u in datos["equipos"][0]["usuarios"]], ["ana@x.com"])
        self.assertEqual([u["email"] for u in datos["sin_equipo"]], ["beto@x.com"])

    def test_asignar_un_equipo_y_despues_quitar_a_uno(self):
        a, b = self.militante("a@x.com", equipo=self.norte), self.militante("b@x.com", equipo=self.norte)
        r = self.asignar(a, b)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.asignados(), {"a@x.com", "b@x.com"})
        self.assertEqual(r.json()["asignados"], 2)
        self.asignar(b)
        self.assertEqual(self.asignados(), {"b@x.com"})

    def test_no_se_quita_a_quien_ya_cargo_encuestas(self):
        # encuestas.(id_usuario, id_cuestionario) es FK a usuariosxcuestionarios
        a = self.militante("a@x.com")
        self.asignar(a)
        from .models import Encuestado
        Encuesta.objects.create(
            cuestionario=self.c, usuario=a, encuestado=Encuestado.objects.create(documento="1", nombre="X")
        )
        r = self.asignar()
        self.assertEqual(r.status_code, 409)
        self.assertIn("ya cargó encuestas", r.json()["error"])
        self.assertEqual(self.asignados(), {"a@x.com"})
        self.assertEqual(Encuesta.objects.filter(usuario=a).count(), 1)

    def test_no_asigna_a_quien_no_es_militante_activo_de_la_campana(self):
        for u in (
            self.militante("ajeno@x.com", campana=self.otra),
            self.militante("inactivo@x.com", activo=False),
            self.militante("sinrol@x.com", rol=False),
        ):
            self.assertEqual(self.asignar(u).status_code, 400, u.email)
        for datos in ({"usuarios": "a"}, {"usuarios": [True]}, {}):
            self.assertEqual(self.enviar("put", self.url, datos).status_code, 400)
        self.assertEqual(self.asignados(), set())

    def test_el_que_dejo_de_ser_militante_aparece_para_poder_quitarlo(self):
        a = self.militante("a@x.com")
        self.asignar(a)
        a.is_active = False
        a.save()
        sin_equipo = self.client.get(self.url).json()["sin_equipo"]
        self.assertEqual([(u["email"], u["asignado"], u["elegible"]) for u in sin_equipo], [("a@x.com", True, False)])
        # Se puede guardar sin tocarlo, y también quitarlo
        self.assertEqual(self.asignar(a).status_code, 200)
        self.asignar()
        self.assertEqual(self.asignados(), set())

    def test_cuestionario_de_otra_campana_no_se_ve(self):
        ajeno = Cuestionario.objects.create(titulo="X", categoria=self.c.categoria)
        # Es de la otra campaña porque está asignado a un usuario de esa campaña
        AsignacionCuestionario.objects.create(usuario=self.militante("otra@x.com", campana=self.otra), cuestionario=ajeno)
        self.assertEqual(self.client.get(f"/api/cuestionarios/{ajeno.pk}/asignaciones/").status_code, 404)

    def test_militante_no_puede_asignar(self):
        self.militante("mili@x.com")
        self.enviar("post", "/api/auth/logout/")
        self.enviar("post", "/api/auth/login/", {"email": "mili@x.com", "password": "clave-segura-123"})
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_queda_en_el_historial(self):
        from django.contrib.admin.models import LogEntry
        a = self.militante("a@x.com")
        antes = LogEntry.objects.count()
        self.asignar(a)
        self.assertEqual(LogEntry.objects.count(), antes + 1)
        self.assertIn("asignó a 1 usuario", LogEntry.objects.latest("pk").change_message)
