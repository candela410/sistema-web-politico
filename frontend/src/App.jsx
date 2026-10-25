import { useEffect, useState } from 'react'
import { cerrarSesion, prepararCsrf, usuarioActual } from './api/auth'
import Login from './Login'

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

  return (
    <main className="centrado">
      <section className="tarjeta">
        <h1>Hola, {usuario.nombre || usuario.email}</h1>
        <p className="secundario">Sesión iniciada como {usuario.email}</p>
        <button type="button" onClick={salir}>
          Cerrar sesión
        </button>
      </section>
    </main>
  )
}

export default App
