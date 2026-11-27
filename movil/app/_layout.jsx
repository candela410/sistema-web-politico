import { useEffect, useRef, useState } from 'react'
import { Animated, Image, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ProveedorSesion, useSesion } from '../src/sesion/Sesion'
import { ARCHIVOS_FUENTES } from '../src/tema/fuentes'
import { MARCA, ProveedorTema, useTema } from '../src/tema/tema'
import { cargarAlmacen } from '../src/util/almacen'
import { Text } from '../src/ui'

// Pantalla de arranque: logo y tres puntos mientras se consulta la sesión
function Arranque() {
  const puntos = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current]
  useEffect(() => {
    const anim = Animated.loop(
      Animated.stagger(
        160,
        puntos.map((p) =>
          Animated.sequence([
            Animated.timing(p, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(p, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
        ),
      ),
    )
    anim.start()
    return () => anim.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <View style={estilos.arranque} accessibilityLabel="Cargando…">
      <Image source={require('../assets/img/logo.png')} style={{ width: 120, height: 96 }} resizeMode="contain" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
        {puntos.map((p, i) => (
          <Animated.View
            key={i}
            style={{ width: 10, height: 10, borderRadius: 5, opacity: p, backgroundColor: [MARCA.violeta, MARCA.celeste, MARCA.magenta][i] }}
          />
        ))}
      </View>
      <Text style={{ marginTop: 12, color: '#6B7280' }}>Cargando…</Text>
    </View>
  )
}

function Navegacion() {
  const { cargando } = useSesion()
  const { c } = useTema()
  if (cargando) return <Arranque />
  return (
    <>
      <StatusBar style={c.oscuro ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fondo } }} />
    </>
  )
}

export default function Raiz() {
  // Lo guardado en el celular (tema, último usuario…) se lee antes de dibujar
  // y las tipografías de la marca. Si las fuentes fallan, la app sigue con las del sistema.
  const [almacenListo, setAlmacenListo] = useState(false)
  const [fuentesCargadas, errorFuentes] = useFonts(ARCHIVOS_FUENTES)
  useEffect(() => {
    cargarAlmacen().finally(() => setAlmacenListo(true))
  }, [])
  const listo = almacenListo && (fuentesCargadas || Boolean(errorFuentes))
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {!listo ? (
          <Arranque />
        ) : (
          <ProveedorTema>
            <ProveedorSesion>
              <Navegacion />
            </ProveedorSesion>
          </ProveedorTema>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const estilos = StyleSheet.create({
  arranque: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
