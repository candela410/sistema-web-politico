// useState: hook de React para guardar valores que cambian (lo que escribe el usuario, errores, etc.)
import { useState } from 'react'
import { Link } from 'react-router'
// iniciarSesion: habla con Django (src/api/auth.js)
import { iniciarSesion, ultimoUsuario } from '../../api/auth'
// Mismas reglas que el backend
import { errorContrasena, errorUsuario } from '../../validaciones'
// Logo del águila (src/assets/logo.png)
import logo from '../../assets/logo.png'
// Olas de colores y foto del fondo (las comparte con Olvide y Restablecer)
import FondoLogin from './FondoLogin'
import CampoContrasena from './CampoContrasena'
import './Login.css'

// Componente Login. Recibe "onIngreso", una función que se ejecuta cuando el login sale bien
// (App.jsx la usa para guardar el usuario y redirigir)
export default function Login({ onIngreso }) {
  // ----- ESTADOS -----
  // Nombre de usuario: apellido + primera letra del nombre (ej: "perezj").
  // Se propone el último que ingresó en este navegador.
  const [nombre, setNombre] = useState(ultimoUsuario)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false) // checkbox "Recordar"
  // Los errores se muestran mientras se escribe (en cuanto el campo tiene algo)
  // y, si quedó vacío, al salir del campo o al enviar
  const [tocados, setTocados] = useState({ nombre: false, password: false })
  const [error, setError] = useState('') // error que devuelve el servidor
  const [loading, setLoading] = useState(false)

  const errores = { nombre: errorUsuario(nombre), password: errorContrasena(password) }
  const valores = { nombre, password }
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }))

  // ----- AL APRETAR "Iniciar sesión" -----
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setTocados({ nombre: true, password: true })
    // Las mismas reglas que valida el backend: si no se cumplen, no se envía
    if (errores.nombre || errores.password) {
      document.getElementById(errores.nombre ? 'usuario' : 'password')?.focus()
      return
    }
    setLoading(true)
    try {
      // "remember" se manda al backend: si es false, la sesión termina al cerrar el navegador
      const usuario = await iniciarSesion(nombre.trim(), password, remember)
      onIngreso?.(usuario)
    } catch (err) {
      setError(err.message || 'El nombre de usuario o la contraseña son incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  const verError = (campo) => (tocados[campo] || valores[campo] !== '' ? errores[campo] : '')

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <img className="login__logo" src={logo} alt="Logo" />

          <h1>Iniciar sesión</h1>
          <p className="login__subtitle">Ingrese a su cuenta para continuar</p>

          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {/* ----- NOMBRE DE USUARIO: sin mayúsculas ni corrector ----- */}
          <label htmlFor="usuario">Nombre de usuario</label>
          <div className={`login__field${verError('nombre') ? ' login__field--error' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={254}
              placeholder="apellido + inicial del nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={tocar('nombre')}
              aria-invalid={Boolean(verError('nombre'))}
              aria-describedby={verError('nombre') ? 'usuario-error' : 'usuario-ayuda'}
            />
          </div>
          {verError('nombre') ? (
            <p id="usuario-error" className="login__ayuda login__ayuda--error">
              {errores.nombre}
            </p>
          ) : (
            <p id="usuario-ayuda" className="login__ayuda">
              Su apellido y la primera letra de su nombre. Ejemplo: Juan Pérez → <b>perezj</b>
            </p>
          )}

          {/* ----- CONTRASEÑA: oculta, con el ojito para verla ----- */}
          <label htmlFor="password">Contraseña</label>
          <CampoContrasena
            id="password"
            value={password}
            onChange={setPassword}
            onBlur={tocar('password')}
            autoComplete="current-password"
            enterKeyHint="go"
            error={verError('password')}
          />

          <div className="login__row">
            <label className="login__check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Recordar</span>
            </label>
            <Link to="/olvide" state={{ usuario: nombre.trim() }}>
              ¿Olvidó su contraseña?
            </Link>
          </div>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          {/* Se deshabilita mientras espera al servidor para evitar el doble clic */}
          <button className="login__submit" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}