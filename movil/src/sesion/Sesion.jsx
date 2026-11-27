// Usuario que inició sesión, compartido por toda la app (en la web vivía en App.jsx).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { cerrarSesion, prepararCsrf } from '../api/auth'
import { alSinCampana } from '../api/cliente'

const Contexto = createContext(null)

export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    prepararCsrf()
      // Como en la web: al abrir la app siempre se pide el login y la sesión que
      // quedó abierta de antes se cierra. "Recordar" solo deja escritos el
      // usuario y la contraseña (util/credenciales.js).
      .then(async () => {
        await cerrarSesion().catch(() => {})
        return null
      })
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])

  // Si el servidor dice que no hay campaña elegida, se vuelve a elegir
  useEffect(
    () =>
      alSinCampana(() => {
        setUsuario((u) => (u ? { ...u, campana: null } : u))
        router.replace('/campana')
      }),
    [],
  )

  const salir = useCallback(async () => {
    await cerrarSesion().catch(() => {})
    setUsuario(null)
    // El próximo usuario empieza de cero, sin heredar la pantalla del anterior
    try {
      if (router.canDismiss?.()) router.dismissAll()
    } catch {
      // nada que cerrar
    }
    router.replace('/login')
  }, [])

  const valor = useMemo(() => ({ usuario, setUsuario, cargando, salir }), [usuario, cargando, salir])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useSesion = () => useContext(Contexto)
