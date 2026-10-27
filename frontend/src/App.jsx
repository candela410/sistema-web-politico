import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { cerrarSesion, prepararCsrf, usuarioActual } from './api/auth'
import Actividad from './components/actividad/Actividad'
import Campanas from './components/campanas/Campanas'
import ElegirCampana from './components/campanas/ElegirCampana'
import Categorias from './components/categorias/Categorias'
import Aviso from './components/comunes/Aviso'
import DetalleCuestionario from './components/cuestionarios/DetalleCuestionario'
import EditorCuestionario from './components/cuestionarios/EditorCuestionario'
import Grupos from './components/grupos/grupos'
import Inicio from './components/inicio/Inicio'
import ListaCuestionarios from './components/cuestionarios/ListaCuestionarios'
import Login from './components/login/Login'
import Mapa from './components/mapa/Mapa'
import Menu from './components/menu/Menu'
import Permisos from './components/permisos/Permisos'
import ListaResponder from './components/responder/ListaResponder'
import ResponderCuestionario from './components/responder/ResponderCuestionario'
import Usuarios from './components/usuarios/Usuarios'
import { inicioDe, tiene } from './permisos'

// Rutas de la app. Cada sección pide un permiso de Django (el mismo que usa el
// menú lateral en components/menu/opciones.js):
//   /login        ingreso
//   /inicio       panel de inicio (todos los que tienen campaña)
//   /campana      elegir la campaña (superusuario o permiso "elegir_campana")
//   /mapa, /cuestionarios(/nuevo|/:id|/:id/estadisticas), /categorias, /responder(/:id)
//   /usuarios, /grupos, /permisos, /actividad, /campanas
// Todo lo que no sea /login, /campana o /campanas necesita una campaña elegida.

function RequiereSesion({ usuario, children }) {
  const ubicacion = useLocation()
  if (!usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  return children
}

function Seccion({ usuario, permiso, sinCampana = false, children }) {
  if (!sinCampana && !usuario.campana) return <Navigate to={inicioDe(usuario)} replace />
  if (permiso && !tiene(usuario, permiso)) return <Navigate to={inicioDe(usuario)} replace />
  return children
}

function PaginaLogin({ usuario, onIngreso }) {
  const navegar = useNavigate()
  const { state } = useLocation()
  if (usuario) return <Navigate to={usuario.campana && state?.desde ? state.desde : inicioDe(usuario)} replace />
  return (
    <Login
      onIngreso={(u) => {
        onIngreso(u)
        navegar(u.campana && state?.desde ? state.desde : inicioDe(u), { replace: true })
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

  // Si el servidor dice que no hay campaña elegida, se vuelve a elegir
  useEffect(() => {
    const volver = () => {
      setUsuario((u) => (u ? { ...u, campana: null } : u))
      navegar('/campana', { replace: true })
    }
    window.addEventListener('sin-campana', volver)
    return () => window.removeEventListener('sin-campana', volver)
  }, [navegar])

  async function salir() {
    await cerrarSesion()
    // Recarga completa: el próximo usuario empieza de cero, sin heredar la
    // página ni los datos del anterior
    window.location.replace('/login')
  }

  if (cargando) return <main className="centrado">Cargando…</main>

  const s = (permiso, elemento, sinCampana) => (
    <Seccion usuario={usuario} permiso={permiso} sinCampana={sinCampana}>
      {elemento}
    </Seccion>
  )

  return (
    <Routes>
      <Route path="/login" element={<PaginaLogin usuario={usuario} onIngreso={setUsuario} />} />
      <Route
        path="/campana"
        element={
          <RequiereSesion usuario={usuario}>
            {usuario?.puede_elegir_campana ? (
              <ElegirCampana
                usuario={usuario}
                onElegida={(u) => {
                  setUsuario(u)
                  navegar(inicioDe(u), { replace: true })
                }}
                onSalir={salir}
              />
            ) : (
              <Navigate to={inicioDe(usuario)} replace />
            )}
          </RequiereSesion>
        }
      />
      <Route
        element={
          <RequiereSesion usuario={usuario}>
            <Menu usuario={usuario} onCambio={setUsuario} onSalir={salir} />
          </RequiereSesion>
        }
      >
        <Route path="/inicio" element={s(null, <Inicio usuario={usuario} />)} />
        <Route path="/mapa" element={s('core.view_zona', <Mapa />)} />
        <Route path="/categorias" element={s('core.view_categoria', <Categorias usuario={usuario} />)} />
        <Route path="/cuestionarios" element={s('core.view_cuestionario', <ListaCuestionarios usuario={usuario} />)} />
        <Route path="/cuestionarios/nuevo" element={s('core.add_cuestionario', <EditorCuestionario key="nuevo" />)} />
        <Route path="/cuestionarios/:id" element={s('core.view_cuestionario', <EditorCuestionario />)} />
        <Route path="/cuestionarios/:id/estadisticas" element={s('core.view_encuesta', <DetalleCuestionario />)} />
        <Route path="/responder" element={s('core.add_encuesta', <ListaResponder />)} />
        <Route path="/responder/:id" element={s('core.add_encuesta', <ResponderCuestionario key="responder" />)} />
        <Route path="/usuarios" element={s('core.view_usuario', <Usuarios usuario={usuario} />)} />
        <Route path="/grupos" element={s('core.view_grupo', <Grupos />)} />
        <Route path="/permisos" element={s('auth.view_group', <Permisos />)} />
        <Route path="/actividad" element={s('admin.view_logentry', <Actividad usuario={usuario} />)} />
        <Route path="/campanas" element={s('core.view_campana', <Campanas usuario={usuario} />, true)} />
        <Route
          path="/sin-campana"
          element={
            <Aviso titulo="Tu usuario no tiene una campaña asignada">
              Pedile a la administración que te asigne a una campaña para poder trabajar.
            </Aviso>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={inicioDe(usuario)} replace />} />
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
