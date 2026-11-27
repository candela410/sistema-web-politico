import { Redirect } from 'expo-router'
import Olvide from '../src/pantallas/login/Olvide'
import { useSesion } from '../src/sesion/Sesion'
import { inicioDe } from '../src/util/permisos'

export default function PaginaOlvide() {
  const { usuario } = useSesion()
  if (usuario) return <Redirect href={inicioDe(usuario)} />
  return <Olvide />
}
