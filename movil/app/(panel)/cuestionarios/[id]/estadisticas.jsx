import { useLocalSearchParams } from 'expo-router'
import DetalleCuestionario from '../../../../src/pantallas/cuestionarios/DetalleCuestionario'
import Seccion from '../../../../src/sesion/Seccion'

export default function Estadisticas() {
  const { id } = useLocalSearchParams()
  return (
    <Seccion permiso="core.view_encuesta">
      <DetalleCuestionario key={id} id={id} />
    </Seccion>
  )
}
