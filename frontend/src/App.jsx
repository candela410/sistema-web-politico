import { useEffect, useState } from 'react'
import { cerrarSesion, prepararCsrf, usuarioActual } from './api/auth'
import Login from './Login'
import Panel from './Panel'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

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
  }

  if (cargando) return <main className="centrado">Cargando…</main>

  if (!usuario) return <Login onIngreso={setUsuario} />

  return <Panel usuario={usuario} onSalir={salir} />
}

export default App
