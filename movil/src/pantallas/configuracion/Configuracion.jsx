import { Pressable } from 'react-native'
import { router } from 'expo-router'
import { DatabaseBackup, UserRound } from 'lucide-react-native'
import { MARCA, useTema } from '../../tema/tema'
import { Encabezado, Fila, Pagina, Text, estiloTarjeta } from '../../ui'
import Backup from './Backup'
import MiPerfil from './MiPerfil'

// Configuración: "Mi perfil" (todos) y "Backup" (solo superusuarios).
export default function Configuracion({ usuario, onCambio, pestana = 'perfil' }) {
  const { c } = useTema()
  const Pestana = ({ ruta, activa, icono: Icono, texto }) => (
    <Pressable
      onPress={() => !activa && router.replace(ruta)}
      accessibilityRole="tab"
      accessibilityState={{ selected: activa }}
      style={{
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: activa ? MARCA.violeta : 'transparent',
      }}
    >
      <Icono size={18} color={activa ? '#fff' : c.texto} />
      <Text style={{ color: activa ? '#fff' : c.texto, fontWeight: '700' }}>{texto}</Text>
    </Pressable>
  )
  return (
    <Pagina>
      <Encabezado titulo="Configuración" descripcion={pestana === 'backup' ? 'Copias de seguridad de la base de datos.' : 'Sus datos en el sistema.'} />
      {usuario.es_superusuario && (
        <Fila gap={4} style={{ ...estiloTarjeta(c), borderRadius: 14, padding: 4 }}>
          <Pestana ruta="/configuracion" activa={pestana !== 'backup'} icono={UserRound} texto="Mi perfil" />
          <Pestana ruta="/configuracion/backup" activa={pestana === 'backup'} icono={DatabaseBackup} texto="Backup" />
        </Fila>
      )}
      {pestana === 'backup' ? <Backup /> : <MiPerfil usuario={usuario} onCambio={onCambio} />}
    </Pagina>
  )
}
