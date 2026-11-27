// Estructura del panel: barra superior + menú lateral (cajón) + la pantalla actual.
// En tablets y pantallas anchas el menú queda fijo a la izquierda.
//
// Desde Expo Router SDK 58 el Drawer solo muestra las pantallas declaradas acá
// con <Drawer.Screen>: si no se declara ninguna, no dibuja nada (pantalla en
// blanco al entrar al panel). Al sumar una pantalla nueva en app/(panel)/,
// agregarla también a PANTALLAS. Qué opciones ve cada usuario lo decide el
// menú propio (util/opciones.js) y cada pantalla con su permiso (Seccion).
import { useWindowDimensions } from 'react-native'
import { Redirect } from 'expo-router'
import { Drawer } from 'expo-router/drawer'
import Barra from '../../src/pantallas/menu/Barra'
import Lateral from '../../src/pantallas/menu/Lateral'
import { useSesion } from '../../src/sesion/Sesion'
import { MARCA, useTema } from '../../src/tema/tema'

const PANTALLAS = [
  'inicio',
  'mapa',
  'mi-ruta',
  'equipos',
  'cuestionarios',
  'categorias',
  'responder',
  'dashboard',
  'analitica',
  'usuarios',
  'grupos',
  'permisos',
  'actividad',
  'configuracion',
  'perfil',
  'tutorial',
  'sin-campana',
]

export default function Panel() {
  const { usuario } = useSesion()
  const { c } = useTema()
  const { width } = useWindowDimensions()
  if (!usuario) return <Redirect href="/login" />
  const permanente = width >= 1000
  return (
    <Drawer
      initialRouteName="inicio"
      drawerContent={(props) => <Lateral {...props} permanente={permanente} />}
      screenOptions={{
        header: (props) => <Barra {...props} permanente={permanente} />,
        drawerType: permanente ? 'permanent' : 'front',
        drawerStyle: { width: 290, backgroundColor: MARCA.violeta },
        overlayColor: c.velo,
        sceneStyle: { backgroundColor: c.fondo },
        swipeEdgeWidth: 40,
      }}
    >
      {PANTALLAS.map((nombre) => (
        <Drawer.Screen key={nombre} name={nombre} />
      ))}
    </Drawer>
  )
}
