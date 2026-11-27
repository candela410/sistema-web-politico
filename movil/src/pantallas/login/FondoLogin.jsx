// Fondo de las pantallas de acceso con el diseño del desarrollo móvil: ola
// violeta arriba, logo, título con la barrita de colores, el formulario y las
// olas violeta / magenta / naranja abajo. Lo usan Login, Olvide y Restablecer.
// Estas pantallas se ven siempre en modo claro.
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { CircleAlert, CircleCheck } from 'lucide-react-native'
import { MARCA } from '../../tema/tema'
import { Franja, Text } from '../../ui'

// Colores fijos (modo claro) de las pantallas de acceso
export const COLORES = {
  texto: '#111111',
  gris: '#6B7280',
  linea: '#D9DCE5',
  error: MARCA.rojo,
  fondoError: '#FEF2F2',
  ok: '#0E8A52',
  fondoOk: '#E7F8F0',
}

export default function FondoLogin({ titulo, subtitulo, children }) {
  const { width } = useWindowDimensions()
  const ancho = Math.min(width, 640)
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          keyboardDismissMode="on-drag"
        >
          {/* Ola superior: ocupa también la zona de la barra de estado */}
          <Svg width="100%" height={width * 0.3} viewBox="0 0 400 120" preserveAspectRatio="none">
            <Path d="M0 0 H400 V50 C340 105 260 98 200 72 C140 46 60 30 0 64 Z" fill={MARCA.violeta} />
          </Svg>

          <SafeAreaView edges={['left', 'right']} style={{ flexGrow: 1 }}>
            <View style={{ flexGrow: 1, justifyContent: 'space-evenly', paddingHorizontal: 28, paddingVertical: 12, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
              <View style={{ marginBottom: 18 }}>
                <Image
                  source={require('../../../assets/img/logo.png')}
                  style={{ width: '100%', height: Math.min(ancho * 0.28, 120), marginBottom: 12 }}
                  resizeMode="contain"
                  accessibilityLabel="Logo"
                />
                <Text style={estilos.titulo} titulo accessibilityRole="header">
                  {titulo}
                </Text>
                {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
                <Franja style={{ marginTop: 10 }} />
              </View>
              <View>{children}</View>
            </View>
          </SafeAreaView>

          {/* Olas inferiores */}
          <Svg width="100%" height={width * 0.2} viewBox="0 0 400 80" preserveAspectRatio="none">
            <Path d="M0 25 C90 0 170 40 250 40 C320 40 360 10 400 20 V80 H0 Z" fill={MARCA.violeta} />
            <Path d="M150 80 C220 50 300 35 400 40 V80 Z" fill={MARCA.magenta} opacity={0.9} />
            <Path d="M290 80 C330 55 365 35 400 22 V80 Z" fill={MARCA.naranja} />
          </Svg>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

// Aviso de error o de "listo" con su ícono (cajas rosada / verde)
export function AvisoAcceso({ tipo = 'error', children }) {
  if (!children) return null
  const error = tipo === 'error'
  const Icono = error ? CircleAlert : CircleCheck
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[estilos.aviso, { backgroundColor: error ? COLORES.fondoError : COLORES.fondoOk }]}
    >
      <Icono size={20} color={error ? COLORES.error : COLORES.ok} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: error ? COLORES.error : COLORES.ok }}>{children}</Text>
    </View>
  )
}

export const estilos = StyleSheet.create({
  titulo: { fontSize: 30, fontWeight: '800', color: COLORES.texto },
  subtitulo: { fontSize: 16, color: COLORES.gris, marginTop: 4, lineHeight: 22 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
  enlace: { color: MARCA.violeta, fontSize: 15, fontWeight: '700', textAlign: 'center', paddingVertical: 14 },
})
