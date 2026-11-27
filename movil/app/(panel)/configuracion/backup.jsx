import { Redirect } from 'expo-router'
import Configuracion from '../../../src/pantallas/configuracion/Configuracion'
import Seccion from '../../../src/sesion/Seccion'
import { useSesion } from '../../../src/sesion/Sesion'

// Backup de la base (solo superusuarios)
export default function PaginaBackup() {
  const { usuario, setUsuario } = useSesion()
  if (!usuario?.es_superusuario) return <Redirect href="/configuracion" />
  return (
    <Seccion>
      <Configuracion usuario={usuario} onCambio={setUsuario} pestana="backup" />
    </Seccion>
  )
}
