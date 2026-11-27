import EditorCuestionario from '../../../src/pantallas/cuestionarios/EditorCuestionario'
import Seccion from '../../../src/sesion/Seccion'

export default function Nuevo() {
  return (
    <Seccion permiso="core.add_cuestionario">
      <EditorCuestionario key="nuevo" />
    </Seccion>
  )
}
