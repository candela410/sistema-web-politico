import { useLocalSearchParams } from 'expo-router'
import ResponderCuestionario from '../../../src/pantallas/responder/ResponderCuestionario'
import Seccion from '../../../src/sesion/Seccion'

export default function Responder() {
  const { id } = useLocalSearchParams()
  return (
    <Seccion permiso="core.add_encuesta">
      <ResponderCuestionario key={id} id={id} />
    </Seccion>
  )
}
