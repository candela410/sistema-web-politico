import { useLocalSearchParams } from 'expo-router'
import Restablecer from '../../src/pantallas/login/Restablecer'

// Enlace del correo: /restablecer/UID/TOKEN (no pide sesión).
// Si al enlace le falta el token, se avisa en vez de ir al login.
export default function PaginaRestablecer() {
  const { partes } = useLocalSearchParams()
  const [uid, token] = Array.isArray(partes) ? partes : String(partes ?? '').split('/')
  return <Restablecer key={`${uid}/${token}`} uid={uid} token={token} />
}
