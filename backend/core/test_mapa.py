from unittest import mock

from django.test import Client, TestCase

from .models import Barrio, Calle, Equipo, Ruta, Usuario, Zona


def cuadrado(x0, y0, lado):
    return {
        "type": "Polygon",
        "coordinates": [[[x0, y0], [x0 + lado, y0], [x0 + lado, y0 + lado], [x0, y0 + lado], [x0, y0]]],
    }


RUTA_ORS = (
    {"type": "LineString", "coordinates": [[-64.2, -31.4], [-64.19, -31.41]]},
    1234,
    900,
)


class MapaTests(TestCase):
    def setUp(self):
        Usuario.objects.create_user(username="ana", email="ana@ejemplo.com", password="clave-segura-123", is_staff=True)
        self.client = Client(enforce_csrf_checks=True)
        self.client.get("/api/auth/csrf/")
        self.enviar("post", "/api/auth/login/", {"email": "ana@ejemplo.com", "password": "clave-segura-123"})

        # Dos barrios dentro de (0,0)-(2,2) y uno afuera
        self.centro = Barrio.objects.create(nombre="Centro", geometria=cuadrado(0, 0, 1))
        self.norte = Barrio.objects.create(nombre="Norte", geometria=cuadrado(1, 1, 1))
        self.lejos = Barrio.objects.create(nombre="Lejos", geometria=cuadrado(10, 10, 1))
        Calle.objects.create(
            nombre="San Martín",
            barrio=self.centro,
            geometria={"type": "MultiLineString", "coordinates": [[[0.1, 0.5], [0.9, 0.5]]]},
        )

    def enviar(self, metodo, url, datos=None):
        csrf = self.client.cookies["csrftoken"].value
        return getattr(self.client, metodo)(
            url, datos or {}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf
        )

    def test_requiere_sesion(self):
        self.enviar("post", "/api/auth/logout/")
        self.assertEqual(self.client.get("/api/mapa/barrios/").status_code, 401)
        self.assertEqual(self.client.get("/api/mapa/zonas/").status_code, 401)

    def test_barrios_y_calles_en_geojson(self):
        datos = self.client.get("/api/mapa/barrios/").json()
        self.assertEqual(datos["type"], "FeatureCollection")
        self.assertEqual(len(datos["features"]), 3)
        calles = self.client.get(f"/api/mapa/calles/?barrio={self.centro.pk}").json()
        self.assertEqual(calles["features"][0]["properties"]["nombre"], "San Martín")

    def test_crear_zona_asigna_barrios_dentro(self):
        r = self.enviar("post", "/api/mapa/zonas/", {"nombre": "Zona 1", "color": "#c3268c", "geometria": cuadrado(0, 0, 2.5)})
        self.assertEqual(r.status_code, 201)
        nombres = {b["nombre"] for b in r.json()["zona"]["barrios"]}
        self.assertEqual(nombres, {"Centro", "Norte"})
        self.lejos.refresh_from_db()
        self.assertIsNone(self.lejos.zona)

    def test_zona_no_roba_barrios_de_otra_zona(self):
        self.enviar("post", "/api/mapa/zonas/", {"nombre": "Zona 1", "geometria": cuadrado(0, 0, 1.2)})
        r = self.enviar("post", "/api/mapa/zonas/", {"nombre": "Zona 2", "geometria": cuadrado(0, 0, 2.5)})
        self.assertEqual([b["nombre"] for b in r.json()["zona"]["barrios"]], ["Norte"])

    def test_zona_invalida(self):
        r = self.enviar("post", "/api/mapa/zonas/", {"nombre": "Mal", "geometria": {"type": "Point", "coordinates": [0, 0]}})
        self.assertEqual(r.status_code, 400)
        r = self.enviar("post", "/api/mapa/zonas/", {"nombre": "", "geometria": cuadrado(0, 0, 1)})
        self.assertEqual(r.status_code, 400)

    def test_editar_y_borrar_zona_libera_barrios(self):
        zona = self.enviar("post", "/api/mapa/zonas/", {"nombre": "Zona 1", "geometria": cuadrado(0, 0, 2.5)}).json()["zona"]
        r = self.enviar("patch", f"/api/mapa/zonas/{zona['id']}/", {"geometria": cuadrado(0, 0, 1.2)})
        self.assertEqual([b["nombre"] for b in r.json()["zona"]["barrios"]], ["Centro"])
        self.assertEqual(self.enviar("delete", f"/api/mapa/zonas/{zona['id']}/").status_code, 200)
        self.assertFalse(Barrio.objects.exclude(zona=None).exists())

    @mock.patch("core.mapa_views.calcular_ruta", return_value=RUTA_ORS)
    def test_crear_ruta_con_openrouteservice(self, calcular):
        zona = Zona.objects.create(nombre="Z", geometria=cuadrado(0, 0, 3))
        paradas = [[-64.2, -31.4], [-64.19, -31.41]]
        r = self.enviar("post", "/api/mapa/rutas/", {"nombre": "Recorrido 1", "paradas": paradas, "zona": zona.pk})
        self.assertEqual(r.status_code, 201, r.content)
        ruta = r.json()["ruta"]
        self.assertEqual((ruta["distancia_m"], ruta["duracion_s"]), (1234, 900))
        calcular.assert_called_once_with(paradas, "foot-walking")
        # Se crea una campaña si no había ninguna
        self.assertEqual(Ruta.objects.get().campana.nombre, "Campaña principal")

    @mock.patch("core.mapa_views.calcular_ruta", return_value=RUTA_ORS)
    def test_renombrar_ruta_no_recalcula(self, calcular):
        ruta = self.enviar("post", "/api/mapa/rutas/", {"nombre": "R", "paradas": [[0, 0], [1, 1]]}).json()["ruta"]
        r = self.enviar("patch", f"/api/mapa/rutas/{ruta['id']}/", {"nombre": "R2"})
        self.assertEqual(r.json()["ruta"]["nombre"], "R2")
        self.assertEqual(calcular.call_count, 1)

    def test_ruta_necesita_dos_puntos(self):
        r = self.enviar("post", "/api/mapa/rutas/", {"nombre": "R", "paradas": [[0, 0]]})
        self.assertEqual(r.status_code, 400)

    def test_ruta_sin_api_key_avisa(self):
        with mock.patch.dict("os.environ", {"ORS_API_KEY": ""}):
            r = self.enviar("post", "/api/mapa/rutas/", {"nombre": "R", "paradas": [[0, 0], [1, 1]]})
        self.assertEqual(r.status_code, 502)
        self.assertIn("ORS_API_KEY", r.json()["error"])

    @mock.patch("core.mapa_views.calcular_ruta", return_value=RUTA_ORS)
    def test_borrar_ruta_deja_equipo_sin_ruta(self, _):
        ruta = self.enviar("post", "/api/mapa/rutas/", {"nombre": "R", "paradas": [[0, 0], [1, 1]]}).json()["ruta"]
        equipo = Equipo.objects.create(nombre="E1", campana=Ruta.objects.get().campana, ruta_id=ruta["id"])
        self.enviar("delete", f"/api/mapa/rutas/{ruta['id']}/")
        equipo.refresh_from_db()
        self.assertIsNone(equipo.ruta)
