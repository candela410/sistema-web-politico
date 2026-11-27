// El login se ve siempre en modo claro, aunque la app esté en modo oscuro
import { useMemo } from 'react'
import { ContextoTema, useTema } from './tema'

export function ProveedorTemaClaro({ children }) {
  const actual = useTema()
  const valor = useMemo(() => ({ ...actual, c: actual.claro }), [actual])
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>
}
