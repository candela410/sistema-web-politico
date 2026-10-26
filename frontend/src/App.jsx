import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { cerrarSesion, prepararCsrf, usuarioActual } from './api/auth'
import Categorias from './components/categorias/Categorias'
import DetalleCuestionario from './components/cuestionarios/DetalleCuestionario'
import EditorCuestionario from './components/cuestionarios/EditorCuestionario'
import Inicio from './components/inicio/Inicio'
import ListaCuestionarios from './components/cuestionarios/ListaCuestionarios'
import Login from './components/login/Login'
import Mapa from './components/mapa/Mapa'
import Menu from './components/menu/Menu'
import ListaResponder from './components/responder/ListaResponder'
import ResponderCuestionario from './components/responder/ResponderCuestionario'

// Rutas de la app (las opciones del menú lateral están en components/menu/opciones.js):
//   /login  pantalla de ingreso (si ya hay sesión, va a la pantalla de inicio)
//   /inicio  panel de inicio (todos; muestra lo que corresponde a cada rol)
//   Administración (is_staff):
//     /mapa  mapa de barrios, zonas y rutas
//     /cuestionarios, /cuestionarios/nuevo, /cuestionarios/:id  lista y editor
//     /cuestionarios/:id/detalle  ver detalle con estadísticas
//     /categorias  ABM de categorías
//   Todos (militantes y administración):
//     /responder, /responder/:id  cargar encuestas
//   Cualquier otra dirección va a la pantalla de inicio de cada rol.

const inicioDe = () => '/inicio'

function RequiereSesion({ usuario, children }) {
  const ubicacion = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  return children
}

// Las secciones de administración no se muestran a los militantes
function SoloAdmin({ usuario, children }) {
  if (!usuario.es_staff) return <Navigate to="/responder" replace />
  return children
}

function PaginaLogin({ usuario, onIngreso }) {
  const navegar = useNavigate()
  const { state } = useLocation()
  if (usuario) return <Navigate to={state?.desde ?? inicioDe(usuario)} replace />
  return (
    <Login
      onIngreso={(u) => {
        onIngreso(u)
        navegar(state?.desde ?? inicioDe(u), { replace: true })
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
            <Menu usuario={usuario} onSalir={salir} />
          </RequiereSesion>
        }
      >
        <Route path="/inicio" element={<Inicio usuario={usuario} />} />
        <Route path="/mapa" element={<SoloAdmin usuario={usuario}><Mapa /></SoloAdmin>} />
        <Route path="/categorias" element={<SoloAdmin usuario={usuario}><Categorias /></SoloAdmin>} />
        <Route path="/cuestionarios" element={<SoloAdmin usuario={usuario}><ListaCuestionarios /></SoloAdmin>} />
        <Route
          path="/cuestionarios/nuevo"
          element={<SoloAdmin usuario={usuario}><EditorCuestionario key="nuevo" /></SoloAdmin>}
        />
        <Route path="/cuestionarios/:id" element={<SoloAdmin usuario={usuario}><EditorCuestionario /></SoloAdmin>} />
        <Route
          path="/cuestionarios/:id/detalle"
          element={<SoloAdmin usuario={usuario}><DetalleCuestionario /></SoloAdmin>}
        />
        <Route path="/responder" element={<ListaResponder />} />
        <Route path="/responder/:id" element={<ResponderCuestionario key="responder" />} />
      </Route>
      <Route path="*" element={<Navigate to={usuario ? inicioDe(usuario) : '/login'} replace />} />
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
