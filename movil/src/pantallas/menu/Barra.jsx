// Barra superior (diseño del desarrollo móvil): violeta con las esquinas de
// abajo redondeadas, botón blanco del menú, logo en un círculo blanco, sección
// actual, modo oscuro y el avatar del usuario.
import { Image, Pressable, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Menu as IconoMenu, Moon, Sun } from 'lucide-react-native'
import { salirDeCampana } from '../../api/campanas'
import { useSesion } from '../../sesion/Sesion'
import { MARCA, useTema } from '../../tema/tema'
import { Text } from '../../ui'
import { opcionActual, seccionesPara } from '../../util/opciones'
import MenuUsuario from './MenuUsuario'

export default function Barra({ navigation, permanente }) {
  const { tema, alternar } = useTema()
  const { usuario, setUsuario, salir } = useSesion()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  if (!usuario) return null
  const actual = opcionActual(seccionesPara(usuario), pathname)
  const oscuro = tema === 'oscuro'

  async function cambiarCampana() {
    setUsuario(await salirDeCampana())
    router.replace('/campana')
  }

  return (
    <View
      style={{
        backgroundColor: MARCA.violeta,
        paddingTop: insets.top,
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
      }}
    >
      {/* Los íconos de la barra de estado van en blanco sobre el violeta */}
      <StatusBar style="light" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 66 }}>
        {!permanente && (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mostrar u ocultar el menú"
            style={({ pressed }) => ({
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <IconoMenu size={24} color={MARCA.violeta} />
          </Pressable>
        )}
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../../assets/img/logo.png')} style={{ width: 38, height: 30 }} resizeMode="contain" accessibilityLabel="Logo" />
        </View>
        <View style={{ flex: 1, marginLeft: 2 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }} titulo numberOfLines={1}>
            Panel de gestión
          </Text>
          <Text style={{ color: MARCA.violetaClaro, fontSize: 12 }} numberOfLines={1}>
            {actual?.texto ?? 'Inicio'}
          </Text>
        </View>
        <Pressable
          onPress={alternar}
          hitSlop={6}
          accessibilityRole="switch"
          accessibilityState={{ checked: oscuro }}
          accessibilityLabel="Modo oscuro"
          style={{ padding: 6 }}
        >
          {oscuro ? <Moon size={22} color="#fff" /> : <Sun size={22} color="#fff" />}
        </Pressable>
        <MenuUsuario usuario={usuario} onCambiarCampana={usuario.puede_elegir_campana ? cambiarCampana : null} onSalir={salir} />
      </View>
    </View>
  )
}
