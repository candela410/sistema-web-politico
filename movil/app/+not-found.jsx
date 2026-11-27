import { Redirect } from 'expo-router'
import { useSesion } from '../src/sesion/Sesion'
import { inicioDe } from '../src/util/permisos'

// Cualquier dirección desconocida lleva al inicio (como el path="*" de la web)
export default function NoEncontrada() {
  const { usuario } = useSesion()
  return <Redirect href={inicioDe(usuario)} />
}
