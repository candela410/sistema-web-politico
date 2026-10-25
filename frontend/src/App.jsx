import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { cerrarSesion, prepararCsrf, usuarioActual } from './api/auth'
import Login from './Login'
import Mapa from './mapa/Mapa'
import Panel from './Panel'

// Rutas de la app:
//   /login  pantalla de ingreso (si ya hay sesión, va al panel)
//   /mapa   mapa de barrios, zonas y rutas (requiere sesión)
//   /       y cualquier otra dirección redirigen a /mapa

function RequiereSesion({ usuario, children }) {
  const ubicacion = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  return children
}

function PaginaLogin({ usuario, onIngreso }) {
  const navegar = useNavigate()
  const { state } = useLocation()
  if (usuario) return <Navigate to={state?.desde ?? '/mapa'} replace />
  return (
    <Login
      onIngreso={(u) => {
        onIngreso(u)
        navegar(state?.desde ?? '/mapa', { replace: true })
      }}
    />
  )
}

function Rutas() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const navegar = useNavigate()

  useEffect(() => {
    prepararCsrf()
      .then(usuarioActual)
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
  }, [])

  async function salir() {
    await cerrarSesion()
    setUsuario(null)
    navegar('/login', { replace: true })
  }

  if (cargando) return <main className="centrado">Cargando…</main>

  return (
    <Routes>
      <Route path="/login" element={<PaginaLogin usuario={usuario} onIngreso={setUsuario} />} />
      <Route
        element={
          <RequiereSesion usuario={usuario}>
            <Panel usuario={usuario} onSalir={salir} />
          </RequiereSesion>
        }
      >
        <Route path="/mapa" element={<Mapa />} />
      </Route>
      <Route path="*" element={<Navigate to="/mapa" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Rutas />
    </BrowserRouter>
  )
}

export default App
