// Protege cada pantalla: pide sesión, campaña elegida (salvo sinCampana) y el
// permiso de Django de la sección (el mismo que usa el menú, util/opciones.js).
import { Redirect } from 'expo-router'
import { inicioDe, tiene } from '../util/permisos'
import { useSesion } from './Sesion'

export default function Seccion({ permiso, sinCampana = false, si = true, children }) {
  const { usuario } = useSesion()
  if (!usuario) return <Redirect href="/login" />
  if (!sinCampana && !usuario.campana) return <Redirect href={inicioDe(usuario)} />
  if (permiso && !tiene(usuario, permiso)) return <Redirect href={inicioDe(usuario)} />
  if (!si) return <Redirect href={inicioDe(usuario)} />
  return children
}

// Envuelve un componente de pantalla: export default conSeccion(Usuarios, 'core.view_usuario')
export const conSeccion = (Pantalla, permiso, opciones = {}) =>
  function PantallaProtegida(props) {
    const { usuario, setUsuario } = useSesion()
    return (
      <Seccion permiso={permiso} {...opciones}>
        <Pantalla usuario={usuario} onCambio={setUsuario} {...props} />
      </Seccion>
    )
  }
