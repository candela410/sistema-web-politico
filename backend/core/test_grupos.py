from django.contrib.auth.models import Group, Permission
from django.test import Client, TestCase

from .models import Campana, Grupo, Usuario


class GruposTests(TestCase):
    def setUp(self):
        self.campana = Campana.objects.create(nombre="Campaña de prueba")
        self.otra = Campana.objects.create(nombre="Otra campaña")
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

    def listar(self):
        return {g["nombre"]: g for g in self.client.get("/api/grupos/").json()["grupos"]}

    def usuario(self, email, campana=None):
        return Usuario.objects.create_user(
            username=email, email=email, password="clave-segura-123", first_name="Juan", campana=campana or self.campana
        )

    def permiso(self, codigo):
        return Permission.objects.get(content_type__app_label="core", codename=codigo)

    def test_requiere_sesion(self):
        self.enviar("post", "/api/auth/logout/")
        self.assertEqual(self.client.get("/api/grupos/").status_code, 401)

    def test_muestra_los_grupos_de_django_como_militantes(self):
        self.assertIn("Militantes", self.listar())

    def test_grupo_asignado_en_usuarios_aparece_con_su_usuario(self):
        u = self.usuario("a@x.com")
        # Se asigna igual que lo hace Gestión → Usuarios
        r = self.enviar(
            "patch", f"/api/usuarios/{u.pk}/",
            {"grupos": [Group.objects.get(name="Militantes").pk], "nombre": "Juan"},
        )
        self.assertEqual(r.status_code, 200)
        militantes = self.listar()["Militantes"]
        self.assertEqual([x["email"] for x in militantes["usuarios"]], ["a@x.com"])

    def test_solo_muestra_usuarios_de_la_campana_activa(self):
        g = Group.objects.create(name="Norte")
        self.usuario("a@x.com").groups.add(g)
        self.usuario("b@x.com", campana=self.otra).groups.add(g)
        self.assertEqual([x["email"] for x in self.listar()["Norte"]["usuarios"]], ["a@x.com"])

    def test_crear_grupo_aparece_en_usuarios(self):
        r = self.enviar(
            "post", "/api/grupos/",
            {"nombre": " Norte ", "descripcion": "Zona norte", "permisos": [self.permiso("view_zona").pk]},
        )
        self.assertEqual(r.status_code, 201)
        grupo = r.json()["grupo"]
        self.assertEqual((grupo["nombre"], grupo["descripcion"], grupo["usuarios"]), ("Norte", "Zona norte", []))
        # Es un grupo de Django: Gestión → Usuarios lo ofrece
        ofrecidos = {g["nombre"]: g for g in self.client.get("/api/usuarios/").json()["grupos"]}
        self.assertIn("Norte", ofrecidos)
        self.assertEqual(ofrecidos["Norte"]["descripcion"], "Zona norte")
        # Y sus permisos son los de verdad
        self.assertEqual(
            list(Group.objects.get(name="Norte").permissions.values_list("codename", flat=True)), ["view_zona"]
        )

    def test_los_permisos_del_grupo_le_llegan_al_usuario(self):
        grupo = self.enviar(
            "post", "/api/grupos/", {"nombre": "Zonas", "permisos": [self.permiso("view_zona").pk]}
        ).json()["grupo"]
        u = self.usuario("a@x.com")
        u.groups.add(Group.objects.get(pk=grupo["id"]))
        u = Usuario.objects.get(pk=u.pk)
        self.assertTrue(u.has_perm("core.view_zona"))
        self.assertFalse(u.has_perm("core.delete_zona"))

    def test_editar_nombre_descripcion_y_permisos(self):
        grupo = self.enviar("post", "/api/grupos/", {"nombre": "Norte", "descripcion": "a"}).json()["grupo"]
        url = f"/api/grupos/{grupo['id']}/"
        r = self.enviar(
            "patch", url, {"nombre": "Norte 2", "descripcion": "b", "permisos": [self.permiso("view_ruta").pk]}
        )
        self.assertEqual(r.status_code, 200)
        g = r.json()["grupo"]
        self.assertEqual((g["nombre"], g["descripcion"], len(g["permisos"])), ("Norte 2", "b", 1))
        self.assertEqual(Group.objects.get(pk=grupo["id"]).name, "Norte 2")
        # Sin "permisos" ni "descripcion" en el cuerpo se conservan
        r = self.enviar("patch", url, {"nombre": "Norte 3"})
        self.assertEqual((r.json()["grupo"]["descripcion"], len(r.json()["grupo"]["permisos"])), ("b", 1))

    def test_editar_conserva_permisos_que_no_son_de_core(self):
        group = Group.objects.create(name="Historial")
        ver_log = Permission.objects.get(codename="view_logentry")
        group.permissions.add(ver_log)
        r = self.enviar("patch", f"/api/grupos/{group.pk}/", {"permisos": [self.permiso("view_zona").pk]})
        self.assertEqual(r.status_code, 200)
        self.assertIn(ver_log, group.permissions.all())

    def test_nombre_obligatorio_y_unico(self):
        self.assertEqual(self.enviar("post", "/api/grupos/", {"nombre": "  "}).status_code, 400)
        r = self.enviar("post", "/api/grupos/", {"nombre": "militantes"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("Ya existe", r.json()["error"])

    def test_permisos_invalidos(self):
        for permisos in ([9999], ["a"], [True], "x", [Permission.objects.get(codename="view_logentry").pk]):
            r = self.enviar("post", "/api/grupos/", {"nombre": "X", "permisos": permisos})
            self.assertEqual(r.status_code, 400, permisos)
        self.assertFalse(Group.objects.filter(name="X").exists())

    def test_no_borra_grupo_con_usuarios(self):
        g = Group.objects.create(name="Norte")
        self.usuario("a@x.com").groups.add(g)
        r = self.enviar("delete", f"/api/grupos/{g.pk}/")
        self.assertEqual(r.status_code, 409)
        self.assertTrue(Group.objects.filter(pk=g.pk).exists())

    def test_borra_grupo_sin_usuarios(self):
        grupo = self.enviar("post", "/api/grupos/", {"nombre": "Norte"}).json()["grupo"]
        self.assertEqual(self.enviar("delete", f"/api/grupos/{grupo['id']}/").status_code, 200)
        self.assertFalse(Group.objects.filter(name="Norte").exists())
        self.assertFalse(Grupo.objects.filter(nombre="Norte").exists())

    def test_militantes_no_se_borra_ni_se_renombra(self):
        g = Group.objects.get(name="Militantes")
        self.assertEqual(self.enviar("delete", f"/api/grupos/{g.pk}/").status_code, 409)
        self.assertEqual(self.enviar("patch", f"/api/grupos/{g.pk}/", {"nombre": "Otros"}).status_code, 409)
        # Pero sí se puede cambiar la descripción
        r = self.enviar("patch", f"/api/grupos/{g.pk}/", {"nombre": "Militantes", "descripcion": "Salen a campo"})
        self.assertEqual(r.json()["grupo"]["descripcion"], "Salen a campo")

    def test_inexistente(self):
        self.assertEqual(self.enviar("delete", "/api/grupos/99999/").status_code, 404)