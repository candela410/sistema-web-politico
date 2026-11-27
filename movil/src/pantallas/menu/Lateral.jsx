// Menú lateral (cajón) con el diseño del desarrollo móvil: cabecera blanca con
// el logo y la marca, ola de colores, opciones en blanco sobre violeta y pie
// decorativo. Las opciones salen de util/opciones.js (según los permisos).
import { Image, Pressable, ScrollView, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'
import { LogOut, Menu as IconoMenu } from 'lucide-react-native'
import { useSesion } from '../../sesion/Sesion'
import { MARCA } from '../../tema/tema'
import { Avatar, Text } from '../../ui'
import { opcionActual, seccionesPara } from '../../util/opciones'
import { nombreDe, rolDe } from '../../util/usuario'

const BLANCO_SUAVE = 'rgba(255,255,255,0.28)'

function Cabecera({ arriba, onCerrar, permanente }) {
  return (
    <View style={{ backgroundColor: '#fff', paddingTop: arriba }}>
      <View style={{ height: 84, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
        {!permanente && (
          <Pressable onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar menú" hitSlop={8} style={{ width: 38, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <IconoMenu size={22} color={MARCA.violeta} />
          </Pressable>
        )}
        <Image source={require('../../../assets/img/logo.png')} style={{ width: 64, height: 60, marginLeft: 2 }} resizeMode="contain" accessibilityLabel="Logo" />
        <View style={{ flexShrink: 1, marginLeft: 4 }}>
          <Text style={{ color: '#171717', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 }} titulo numberOfLines={1} adjustsFontSizeToFit>
            LA LIBERTAD
          </Text>
          <Text style={{ color: '#171717', fontSize: 14, fontWeight: '700', letterSpacing: 1.4 }} titulo numberOfLines={1} adjustsFontSizeToFit>
            AVANZA
          </Text>
        </View>
      </View>
      {/* Ola de la marca: violeta con dos líneas, magenta y naranja */}
      <Svg width="100%" height={44} viewBox="0 0 400 70" preserveAspectRatio="none">
        <Path d="M0 18 C75 1 125 7 200 26 C275 45 335 39 400 15 V70 H0 Z" fill={MARCA.violeta} />
        <Path d="M0 13 C75 -4 125 2 200 21 C275 40 335 34 400 10" fill="none" stroke={MARCA.magenta} strokeWidth={5} />
        <Path d="M0 24 C75 7 125 13 200 32 C275 51 335 45 400 21" fill="none" stroke={MARCA.naranja} strokeWidth={5} />
      </Svg>
    </View>
  )
}

function Pie({ abajo }) {
  return (
    <View style={{ height: 60 + abajo }}>
      <Svg width="100%" height="100%" viewBox="0 0 400 90" preserveAspectRatio="none">
        <Rect width="400" height="90" fill={MARCA.violeta} />
        <Path d="M0 30 C80 5 145 60 235 46 C305 35 347 15 400 4 V90 H0 Z" fill={MARCA.magenta} />
        <Path d="M0 54 C76 36 133 72 214 69 C291 67 347 42 400 51 V90 H0 Z" fill={MARCA.naranja} />
      </Svg>
    </View>
  )
}

function Opcion({ icono: Icono, texto, activa, onPress, rol = 'link' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={rol}
      accessibilityState={{ selected: activa }}
      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      style={({ pressed }) => ({
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: activa ? 'rgba(255,255,255,0.18)' : pressed ? 'rgba(255,255,255,0.12)' : 'transparent',
      })}
    >
      {activa && <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: MARCA.naranja }} />}
      <Icono size={20} strokeWidth={activa ? 2.2 : 1.8} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: activa ? '700' : '600' }}>{texto}</Text>
    </Pressable>
  )
}

export default function Lateral({ navigation, permanente }) {
  const { usuario, salir } = useSesion()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  if (!usuario) return null
  const secciones = seccionesPara(usuario)
  const actual = opcionActual(secciones, pathname)

  return (
    <View style={{ flex: 1, backgroundColor: MARCA.violeta }}>
      <Cabecera arriba={insets.top} onCerrar={() => navigation.closeDrawer()} permanente={permanente} />

      {/* Usuario conectado y campaña activa */}
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar usuario={usuario} tamano={42} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {nombreDe(usuario)}
            </Text>
            <Text style={{ color: MARCA.violetaClaro, fontSize: 12.5 }}>{rolDe(usuario)}</Text>
          </View>
        </View>
        {usuario.campana && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22b26b' }} />
            <Text style={{ flex: 1, color: '#fff', fontSize: 12.5, fontWeight: '700' }} numberOfLines={1}>
              {usuario.campana.nombre}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {secciones.map((seccion, i) => (
          <View key={seccion.titulo ?? i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: BLANCO_SUAVE, marginTop: 8, paddingTop: 8 } : undefined}>
            {seccion.titulo && (
              <Text style={{ color: MARCA.violetaClaro, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: 10, marginBottom: 2 }}>
                {seccion.titulo}
              </Text>
            )}
            {seccion.opciones.map(({ ruta, texto, icono }) => (
              <Opcion
                key={ruta}
                icono={icono}
                texto={texto}
                activa={actual?.ruta === ruta}
                onPress={() => {
                  navigation.closeDrawer()
                  router.navigate(ruta)
                }}
              />
            ))}
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderTopColor: BLANCO_SUAVE, marginTop: 8, paddingTop: 8 }}>
          <Opcion icono={LogOut} texto="Cerrar sesión" onPress={salir} rol="button" />
        </View>
      </ScrollView>

      <Pie abajo={insets.bottom} />
    </View>
  )
}
