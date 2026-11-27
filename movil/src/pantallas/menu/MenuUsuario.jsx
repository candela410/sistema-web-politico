import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowLeftRight, LogOut, Settings } from 'lucide-react-native'
import { useTema } from '../../tema/tema'
import { Avatar, Modal, Texto, Text } from '../../ui'
import { nombreDe, rolDe } from '../../util/usuario'

// Usuario en la barra superior; al tocarlo muestra sus datos, "Configuración",
// la campaña activa, "Cambiar campaña" y "Salir".
export default function MenuUsuario({ usuario, onCambiarCampana, onSalir }) {
  const { c } = useTema()
  const [abierto, setAbierto] = useState(false)
  const opcion = (Icono, texto, accion, color = c.texto) => (
    <Pressable
      onPress={() => {
        setAbierto(false)
        accion()
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 8, borderRadius: 10, backgroundColor: pressed ? c.superficie2 : 'transparent' })}
    >
      <Icono size={20} color={color} />
      <Text style={{ color, fontSize: 15.5, fontWeight: '600' }}>{texto}</Text>
    </Pressable>
  )
  return (
    <>
      <Pressable onPress={() => setAbierto(true)} accessibilityLabel={`Usuario: ${nombreDe(usuario)}`} hitSlop={4}>
        <Avatar usuario={usuario} tamano={36} />
      </Pressable>
      {abierto && (
        <Modal titulo={nombreDe(usuario)} onCerrar={() => setAbierto(false)}>
          <Texto estilo="suave">
            {usuario.username} · {rolDe(usuario)}
          </Texto>
          <View style={{ height: 1, backgroundColor: c.linea, marginVertical: 10 }} />
          {opcion(Settings, 'Configuración', () => router.navigate('/configuracion'))}
          {usuario.campana && (
            <View style={{ paddingVertical: 10, paddingHorizontal: 8 }}>
              <Texto estilo="chico">Campaña activa</Texto>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22b26b' }} />
                <Texto estilo="negrita">{usuario.campana.nombre}</Texto>
              </View>
            </View>
          )}
          {onCambiarCampana && opcion(ArrowLeftRight, 'Cambiar campaña', onCambiarCampana)}
          {opcion(LogOut, 'Salir', onSalir, c.rojoTexto)}
        </Modal>
      )}
    </>
  )
}
