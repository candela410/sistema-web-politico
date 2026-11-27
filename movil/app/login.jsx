import { Redirect, router } from 'expo-router'
import Login from '../src/pantallas/login/Login'
import { useSesion } from '../src/sesion/Sesion'
import { inicioDe } from '../src/util/permisos'

export default function PaginaLogin() {
  const { usuario, setUsuario } = useSesion()
  if (usuario) return <Redirect href={inicioDe(usuario)} />
  return (
    <Login
      onIngreso={(u) => {
        setUsuario(u)
        router.replace(inicioDe(u))
      }}
    />
  )
}
