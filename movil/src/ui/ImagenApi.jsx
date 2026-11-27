// Imagen PNG de la API que necesita la sesión (gráficos de matplotlib).
// Se descarga con las cookies y se muestra como data URI.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, View, useWindowDimensions } from 'react-native'
import { Maximize2, RotateCw } from 'lucide-react-native'
import { pedirImagen } from '../api/cliente'
import { MARCA, useTema } from '../tema/tema'
import { Texto } from './base'
import { Modal } from './ventanas'

// Al tocar el gráfico se abre en grande, a pantalla completa (salvo que se
// pase alTocar para hacer otra cosa)
export default function ImagenApi({ url, relacion = 1.6, onCargada, alTocar, etiqueta }) {
  const { c } = useTema()
  const [grande, setGrande] = useState(false)
  const [estado, setEstado] = useState({ url: null, datos: null, error: '' })
  const [proporcion, setProporcion] = useState(relacion)

  useEffect(() => {
    let vigente = true
    pedirImagen(url)
      .then((datos) => {
        if (!vigente) return
        setEstado({ url, datos, error: '' })
        Image.getSize(datos, (w, h) => vigente && h && setProporcion(w / h), () => {})
        onCargada?.(datos)
      })
      .catch((e) => vigente && setEstado({ url, datos: null, error: e.message }))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const actual = estado.url === url
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: proporcion,
        backgroundColor: '#fff',
        borderRadius: 10,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: c.oscuro ? 0 : 1,
        borderColor: c.linea,
      }}
    >
      {!actual ? (
        <ActivityIndicator color={MARCA.violeta} />
      ) : estado.error ? (
        <Texto estilo="error" style={{ padding: 12, textAlign: 'center' }}>
          {estado.error}
        </Texto>
      ) : (
        <Pressable
          onPress={() => (alTocar ? alTocar(estado.datos) : setGrande(true))}
          style={{ width: '100%', height: '100%' }}
          accessibilityRole="imagebutton"
          accessibilityLabel={etiqueta}
          accessibilityHint="Abre el gráfico en grande"
        >
          <Image source={{ uri: estado.datos }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          {!alTocar && (
            <View style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(21,18,28,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Maximize2 size={16} color="#fff" />
            </View>
          )}
        </Pressable>
      )}
      {grande && estado.datos ? (
        <GraficoGrande datos={estado.datos} proporcion={proporcion} etiqueta={etiqueta} onCerrar={() => setGrande(false)} />
      ) : null}
    </View>
  )
}

// Gráfico en grande dentro de la ventana de la app (la misma de los
// formularios: bordes redondeados, franja de colores, título y fondo atenuado).
// Con el celular vertical los gráficos anchos se ven chicos, así que se
// muestran girados para ocupar todo el alto; "Girar" los vuelve a poner derechos.
// Se cierra con la X, tocando afuera o con "atrás" en Android.
function GraficoGrande({ datos, proporcion, etiqueta, onCerrar }) {
  const { c } = useTema()
  const { width, height } = useWindowDimensions()
  const vertical = height > width
  const [girado, setGirado] = useState(vertical && proporcion > 1.15)
  // Lugar disponible dentro de la ventana (sin título, márgenes ni botón)
  const anchoLibre = Math.min(760, width - 24) - 40
  const altoLibre = height * 0.9 - 170
  // Girado: el ancho del gráfico ocupa el alto de la ventana
  const largo = girado ? Math.min(altoLibre, anchoLibre * proporcion) : anchoLibre
  const corto = largo / proporcion
  const [titulo, ...resto] = String(etiqueta ?? 'Gráfico').split(': ')
  const detalle = resto.join(': ')
  return (
    <Modal titulo={titulo} onCerrar={onCerrar} ancho>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: girado ? corto : largo, height: girado ? largo : corto }}>
          <View
            style={{
              position: 'absolute',
              width: largo,
              height: corto,
              left: girado ? (corto - largo) / 2 : 0,
              top: girado ? (largo - corto) / 2 : 0,
              transform: girado ? [{ rotate: '90deg' }] : [],
              backgroundColor: '#fff',
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: c.oscuro ? 0 : 1,
              borderColor: c.linea,
            }}
          >
            <Image source={{ uri: datos }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={etiqueta} />
          </View>
        </View>
      </View>
      {detalle ? (
        <Texto estilo="suave" style={{ marginTop: 10 }}>
          {detalle}
        </Texto>
      ) : null}
      {vertical && (
        <Pressable
          onPress={() => setGirado((g) => !g)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 12,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            minHeight: 40,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: MARCA.violeta,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <RotateCw size={16} color={c.violetaTexto} />
          <Texto estilo="negrita" style={{ color: c.violetaTexto }}>
            {girado ? 'Ver derecho' : 'Girar para verlo más grande'}
          </Texto>
        </Pressable>
      )}
    </Modal>
  )
}

