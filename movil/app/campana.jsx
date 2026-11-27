import { Redirect, router } from 'expo-router'
import ElegirCampana from '../src/pantallas/campanas/ElegirCampana'
import { useSesion } from '../src/sesion/Sesion'
import { inicioDe } from '../src/util/permisos'

// Elegir, crear o desactivar campañas (superusuario o permiso "elegir la campaña")
export default function PaginaCampana() {
  const { usuario, setUsuario, salir } = useSesion()
  if (!usuario) return <Redirect href="/login" />
  if (!usuario.puede_elegir_campana) return <Redirect href={inicioDe(usuario)} />
  return (
    <ElegirCampana
      usuario={usuario}
      onElegida={(u) => {
        setUsuario(u)
        router.replace(inicioDe(u))
      }}
      onSalir={salir}
    />
  )
}
