
import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router'
import { cerrarSesion, prepararCsrf, usuarioActual } from './api/auth'
import Categorias from './components/categorias/Categorias'
import DetalleCuestionario from './components/cuestionarios/DetalleCuestionario'
import EditorCuestionario from './components/cuestionarios/EditorCuestionario'
import ListaCuestionarios from './components/cuestionarios/ListaCuestionarios'
import Grupos from './components/grupos/grupos'
import Login from './components/login/Login'
import Mapa from './components/mapa/Mapa'
import Menu from './components/menu/Menu'
import ListaResponder from './components/responder/ListaResponder'
import ResponderCuestionario from './components/responder/ResponderCuestionario'

const inicioDe = (usuario) =>
  usuario?.es_staff ? '/mapa' : '/responder'

function RequiereSesion({ usuario, children }) {
  const ubicacion = useLocation()

  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ desde: ubicacion.pathname }}
      />
    )
  }

  return children
}

function SoloAdmin({ usuario, children }) {
  if (!usuario.es_staff) {
    return <Navigate to="/responder" replace />
  }

  return children
}

function PaginaLogin({ usuario, onIngreso }) {
  const navegar = useNavigate()
  const { state } = useLocation()

  if (usuario) {
    return (
      <Navigate
        to={state?.desde ?? inicioDe(usuario)}
        replace
      />
    )
  }

  return (
    <Login
      onIngreso={(u) => {
        onIngreso(u)
        navegar(state?.desde ?? inicioDe(u), {
          replace: true,
        })
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

  if (cargando) {
    return <main className="centrado">Cargando…</main>
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PaginaLogin
            usuario={usuario}
            onIngreso={setUsuario}
          />
        }
      />

      <Route
        element={
          <RequiereSesion usuario={usuario}>
            <Menu usuario={usuario} onSalir={salir} />
          </RequiereSesion>
        }
      >
        <Route
          path="/mapa"
          element={
            <SoloAdmin usuario={usuario}>
              <Mapa />
            </SoloAdmin>
          }
        />

        <Route
          path="/categorias"
          element={
            <SoloAdmin usuario={usuario}>
              <Categorias />
            </SoloAdmin>
          }
        />

        <Route
          path="/grupos"
          element={
            <SoloAdmin usuario={usuario}>
              <Grupos />
            </SoloAdmin>
          }
        />

        <Route
          path="/cuestionarios"
          element={
            <SoloAdmin usuario={usuario}>
              <ListaCuestionarios />
            </SoloAdmin>
          }
        />

        <Route
          path="/cuestionarios/nuevo"
          element={
            <SoloAdmin usuario={usuario}>
              <EditorCuestionario key="nuevo" />
            </SoloAdmin>
          }
        />

        <Route
          path="/cuestionarios/:id"
          element={
            <SoloAdmin usuario={usuario}>
              <EditorCuestionario />
            </SoloAdmin>
          }
        />

        <Route
          path="/cuestionarios/:id/detalle"
          element={
            <SoloAdmin usuario={usuario}>
              <DetalleCuestionario />
            </SoloAdmin>
          }
        />

        <Route
          path="/responder"
          element={<ListaResponder />}
        />

        <Route
          path="/responder/:id"
          element={
            <ResponderCuestionario key="responder" />
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={usuario ? inicioDe(usuario) : '/login'}
            replace
          />
        }
      />
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
