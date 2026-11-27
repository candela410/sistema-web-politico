import { useLocalSearchParams } from 'expo-router'
import EditorCuestionario from '../../../../src/pantallas/cuestionarios/EditorCuestionario'
import Seccion from '../../../../src/sesion/Seccion'

export default function Editar() {
  const { id } = useLocalSearchParams()
  return (
    <Seccion permiso="core.view_cuestionario">
      <EditorCuestionario key={id} id={id} />
    </Seccion>
  )
}
