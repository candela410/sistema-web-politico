// Punto numerado de una ruta (en la web era un divIcon de Leaflet)
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Marker } from 'react-native-maps'
import { Text } from '../../ui'

export default function Parada({ coordenada, numero, color = '#c3268c', arrastrable, onArrastrar, onPress }) {
  // Android dibuja el marcador una vez: se deja seguir cambios un momento y después se congela
  const [seguir, setSeguir] = useState(true)
  useEffect(() => {
    setSeguir(true)
    const t = setTimeout(() => setSeguir(false), 400)
    return () => clearTimeout(t)
  }, [numero, color])
  return (
    <Marker
      coordinate={coordenada}
      anchor={{ x: 0.5, y: 0.5 }}
      draggable={arrastrable}
      onDragEnd={(e) => onArrastrar?.(e.nativeEvent.coordinate)}
      onPress={onPress}
      tracksViewChanges={seguir}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{numero}</Text>
      </View>
    </Marker>
  )
}
