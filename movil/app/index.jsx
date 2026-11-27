import { Redirect } from 'expo-router'
import { useSesion } from '../src/sesion/Sesion'
import { inicioDe } from '../src/util/permisos'

export default function Entrada() {
  const { usuario } = useSesion()
  return <Redirect href={inicioDe(usuario)} />
}
