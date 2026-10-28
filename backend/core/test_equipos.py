from django.test import Client, TestCase

from .models import Campana, Equipo, Militante, Ruta, Usuario


class EquiposTests(TestCase):
    def setUp(self):
        self.campana = Campana.objects.create(nombre="Campaña de prueba")
        self.otra = Campana.objects.create(nombre="Otra campaña")
        self.ruta = Ruta.objects.create(nombre="Ruta centro", campana=self.campana, paradas=[])
        self.ruta2 = Ruta.objects.create(nombre="Ruta norte", campana=self.campana, paradas=[])
        self.ruta_ajena = Ruta.objects.create(nombre="Ruta ajena", campana=self.otra, paradas=[])
        Usuario.objects.create_superuser(username="ana", email="ana@ejemplo.com", password="clave-segura-123")
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.enviar("post", "/api/auth/login/", {"email": "ana@ejemplo.com", "password": "clave-segura-123"})
        self.enviar("post", "/api/campanas/activa/", {"campana": self.campana.pk})

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(
            url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )

    def militante(self, email, campana=None, activo=True, equipo=None, nombre="Juan", con_ficha=True):
        usuario = Usuario.objects.create_user(
            username=email, email=email, password="clave-segura-123", first_name=nombre,
            last_name="Pérez", campana=campana or self.campana, is_active=activo,
        )
        if con_ficha:
            Militante.objects.create(nombre=nombre, apellido="Pérez", usuario=usuario, equipo=equipo, activo=activo)
        return usuario

    def crear(self, nombre="Norte", ruta=None):
        return self.enviar("post", "/api/equipos/", {"nombre": nombre, "ruta": ruta or self.ruta.pk})

    def test_requiere_sesion(self):
        self.enviar("post", "/api/auth/logout/")
        self.assertEqual(self.client.get("/api/equipos/").status_code, 401)

    def test_crear_listar_editar(self):
        r = self.enviar("post", "/api/equipos/", {"nombre": "  Norte ", "ruta": self.ruta.pk})
        self.assertEqual(r.status_code, 201)
        equipo = r.json()["equipo"]
        self.assertEqual((equipo["nombre"], equipo["ruta"], equipo["activo"]), ("Norte", self.ruta.pk, True))

        lista = self.client.get("/api/equipos/").json()
        self.assertEqual([e["nombre"] for e in lista["equipos"]], ["Norte"])
        # El selector solo recibe rutas de la campaña activa
        self.assertEqual([r["nombre"] for r in lista["rutas"]], ["Ruta centro", "Ruta norte"])

        r = self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"nombre": "Norte 2", "ruta": self.ruta2.pk})
        self.assertEqual(r.json()["equipo"]["nombre"], "Norte 2")
        self.assertEqual(r.json()["equipo"]["ruta"], self.ruta2.pk)

    def test_no_se_crea_sin_ruta(self):
        for datos in ({"nombre": "X"}, {"nombre": "X", "ruta": None}, {"nombre": "X", "ruta": ""}):
            r = self.enviar("post", "/api/equipos/", datos)
            self.assertEqual(r.status_code, 400)
            self.assertIn("ruta", r.json()["error"])
        self.assertFalse(Equipo.objects.exists())

    def test_no_se_puede_quitar_la_ruta_al_editar(self):
        equipo = self.crear().json()["equipo"]
        r = self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"nombre": "Norte", "ruta": None})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Equipo.objects.get().ruta_id, self.ruta.pk)

    def test_editar_sin_ruta_en_el_cuerpo_conserva_la_ruta(self):
        equipo = Equipo.objects.create(nombre="Oeste", campana=self.campana, ruta=self.ruta)
        r = self.enviar("patch", f"/api/equipos/{equipo.pk}/", {"nombre": "Oeste 2"})
        self.assertEqual(r.json()["equipo"]["ruta"], self.ruta.pk)

    def test_nombre_obligatorio_y_unico_por_campana(self):
        self.assertEqual(self.enviar("post", "/api/equipos/", {"nombre": "  ", "ruta": self.ruta.pk}).status_code, 400)
        self.crear("Sur")
        r = self.crear("sur")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Ya existe", r.json()["error"])
        # En otra campaña el mismo nombre es válido
        Equipo.objects.create(nombre="Este", campana=self.otra)
        self.assertEqual(self.crear("Este").status_code, 201)

    def test_ruta_de_otra_campana_o_inexistente(self):
        for ruta in (self.ruta_ajena.pk, 9999, "abc"):
            r = self.enviar("post", "/api/equipos/", {"nombre": "X", "ruta": ruta})
            self.assertEqual(r.status_code, 400)

    def test_equipo_con_ruta_no_se_borra(self):
        equipo = self.crear().json()["equipo"]
        r = self.enviar("delete", f"/api/equipos/{equipo['id']}/")
        self.assertEqual(r.status_code, 409)
        self.assertIn("Desactivalo", r.json()["error"])
        self.assertTrue(Equipo.objects.filter(pk=equipo["id"]).exists())

    def test_desactivar_y_activar(self):
        equipo = self.crear().json()["equipo"]
        url = f"/api/equipos/{equipo['id']}/"
        r = self.enviar("patch", url, {"activo": False})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["equipo"]["activo"])
        self.assertEqual(r.json()["equipo"]["ruta"], self.ruta.pk)  # conserva la ruta
        self.assertFalse(Equipo.objects.get().activo)

        r = self.enviar("patch", url, {"activo": True})
        self.assertTrue(r.json()["equipo"]["activo"])

    def test_activo_debe_ser_booleano(self):
        equipo = self.crear().json()["equipo"]
        r = self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"activo": "no"})
        self.assertEqual(r.status_code, 400)

    def test_no_se_activa_un_equipo_sin_ruta(self):
        equipo = Equipo.objects.create(nombre="Viejo", campana=self.campana, activo=False)
        url = f"/api/equipos/{equipo.pk}/"
        self.assertEqual(self.enviar("patch", url, {"activo": True}).status_code, 400)
        # Con ruta sí
        r = self.enviar("patch", url, {"nombre": "Viejo", "ruta": self.ruta.pk, "activo": True})
        self.assertEqual(r.status_code, 200)

    def test_equipo_sin_ruta_si_se_puede_borrar(self):
        # Pasa cuando se borra la ruta (SET_NULL) o con datos anteriores
        equipo = Equipo.objects.create(nombre="Huérfano", campana=self.campana)
        self.assertEqual(self.enviar("delete", f"/api/equipos/{equipo.pk}/").status_code, 200)
        self.assertFalse(Equipo.objects.exists())

    def test_no_ve_ni_toca_equipos_de_otra_campana(self):
        ajeno = Equipo.objects.create(nombre="Ajeno", campana=self.otra)
        self.assertEqual(self.client.get("/api/equipos/").json()["equipos"], [])
        self.assertEqual(self.enviar("patch", f"/api/equipos/{ajeno.pk}/", {"activo": False}).status_code, 404)
        self.assertEqual(self.enviar("delete", f"/api/equipos/{ajeno.pk}/").status_code, 404)

    def test_borrar_equipo_deja_militantes_sin_equipo(self):
        equipo = Equipo.objects.create(nombre="Centro", campana=self.campana)
        militante = Militante.objects.create(nombre="Juan", apellido="Pérez", equipo=equipo)
        self.assertEqual(self.enviar("delete", f"/api/equipos/{equipo.pk}/").status_code, 200)
        militante.refresh_from_db()
        self.assertIsNone(militante.equipo)

    # --- Usuarios del equipo -------------------------------------------------

    def disponibles(self):
        return [u["email"] for u in self.client.get("/api/equipos/").json()["usuarios_disponibles"]]

    def test_disponibles_solo_usuarios_activos_de_la_campana_sin_equipo(self):
        self.militante("libre@x.com")
        self.militante("inactivo@x.com", activo=False)
        self.militante("ajeno@x.com", campana=self.otra)
        self.militante("sinficha@x.com", con_ficha=False)
        equipo = Equipo.objects.create(nombre="Otro", campana=self.campana, ruta=self.ruta)
        self.militante("ocupado@x.com", equipo=equipo)
        self.assertEqual(self.disponibles(), ["libre@x.com"])

    def test_crear_con_usuarios(self):
        a, b = self.militante("a@x.com", nombre="Ana"), self.militante("b@x.com", nombre="Beto")
        r = self.enviar("post", "/api/equipos/", {"nombre": "Norte", "ruta": self.ruta.pk, "usuarios": [a.pk, b.pk]})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(sorted(u["email"] for u in r.json()["equipo"]["usuarios"]), ["a@x.com", "b@x.com"])
        self.assertEqual(Militante.objects.get(usuario=a).equipo_id, r.json()["equipo"]["id"])
        # Ya no aparecen como disponibles
        self.assertEqual(self.disponibles(), [])
        # Y el listado devuelve los integrantes
        lista = self.client.get("/api/equipos/").json()["equipos"]
        self.assertEqual(len(lista[0]["usuarios"]), 2)

    def test_usuarios_es_opcional_al_crear(self):
        self.militante("a@x.com")
        r = self.crear()
        self.assertEqual(r.json()["equipo"]["usuarios"], [])
        self.assertEqual(self.disponibles(), ["a@x.com"])

    def test_no_asigna_usuario_que_ya_tiene_equipo(self):
        u = self.militante("a@x.com")
        self.enviar("post", "/api/equipos/", {"nombre": "Uno", "ruta": self.ruta.pk, "usuarios": [u.pk]})
        r = self.enviar("post", "/api/equipos/", {"nombre": "Dos", "ruta": self.ruta.pk, "usuarios": [u.pk]})
        self.assertEqual(r.status_code, 400)
        self.assertIn("ya está en otro equipo", r.json()["error"])
        self.assertFalse(Equipo.objects.filter(nombre="Dos").exists())

    def test_no_asigna_usuarios_invalidos(self):
        ajeno = self.militante("ajeno@x.com", campana=self.otra)
        sin_ficha = self.militante("sinficha@x.com", con_ficha=False)
        inactivo = self.militante("inactivo@x.com", activo=False)
        for usuarios in ([ajeno.pk], [sin_ficha.pk], [9999], ["a"], [True], "a@x.com"):
            r = self.enviar("post", "/api/equipos/", {"nombre": "X", "ruta": self.ruta.pk, "usuarios": usuarios})
            self.assertEqual(r.status_code, 400, usuarios)
        r = self.enviar("post", "/api/equipos/", {"nombre": "X", "ruta": self.ruta.pk, "usuarios": [inactivo.pk]})
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Equipo.objects.exists())

    def test_editar_reemplaza_usuarios(self):
        a, b, c = self.militante("a@x.com"), self.militante("b@x.com"), self.militante("c@x.com")
        equipo = self.enviar(
            "post", "/api/equipos/", {"nombre": "Norte", "ruta": self.ruta.pk, "usuarios": [a.pk, b.pk]}
        ).json()["equipo"]
        url = f"/api/equipos/{equipo['id']}/"
        r = self.enviar("patch", url, {"nombre": "Norte", "ruta": self.ruta.pk, "usuarios": [b.pk, c.pk]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(sorted(u["email"] for u in r.json()["equipo"]["usuarios"]), ["b@x.com", "c@x.com"])
        self.assertIsNone(Militante.objects.get(usuario=a).equipo)
        # El que se sacó vuelve a estar disponible
        self.assertEqual(self.disponibles(), ["a@x.com"])
        # Se puede dejar sin usuarios
        r = self.enviar("patch", url, {"usuarios": []})
        self.assertEqual(r.json()["equipo"]["usuarios"], [])

    def test_activar_o_desactivar_conserva_los_usuarios(self):
        u = self.militante("a@x.com")
        equipo = self.enviar(
            "post", "/api/equipos/", {"nombre": "Norte", "ruta": self.ruta.pk, "usuarios": [u.pk]}
        ).json()["equipo"]
        r = self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"activo": False})
        self.assertEqual([x["email"] for x in r.json()["equipo"]["usuarios"]], ["a@x.com"])
        self.assertEqual(Militante.objects.get(usuario=u).equipo_id, equipo["id"])

    def test_editar_el_nombre_sin_usuarios_en_el_cuerpo_los_conserva(self):
        u = self.militante("a@x.com")
        equipo = self.enviar(
            "post", "/api/equipos/", {"nombre": "Norte", "ruta": self.ruta.pk, "usuarios": [u.pk]}
        ).json()["equipo"]
        r = self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"nombre": "Norte 2", "ruta": self.ruta.pk})
        self.assertEqual(len(r.json()["equipo"]["usuarios"]), 1)

    def test_editar_no_toca_militantes_sin_usuario(self):
        equipo = Equipo.objects.create(nombre="Norte", campana=self.campana, ruta=self.ruta)
        suelto = Militante.objects.create(nombre="Sin", apellido="Cuenta", equipo=equipo)
        self.enviar("patch", f"/api/equipos/{equipo.pk}/", {"usuarios": []})
        suelto.refresh_from_db()
        self.assertEqual(suelto.equipo_id, equipo.pk)

    def test_un_equipo_desactivado_sigue_teniendo_a_sus_usuarios(self):
        u = self.militante("a@x.com")
        equipo = self.enviar(
            "post", "/api/equipos/", {"nombre": "Norte", "ruta": self.ruta.pk, "usuarios": [u.pk]}
        ).json()["equipo"]
        self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"activo": False})
        self.assertEqual(self.disponibles(), [])
        # Para liberarlo se edita el equipo y se lo saca
        self.enviar("patch", f"/api/equipos/{equipo['id']}/", {"usuarios": []})
        self.assertEqual(self.disponibles(), ["a@x.com"])