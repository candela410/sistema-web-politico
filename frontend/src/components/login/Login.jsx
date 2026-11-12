// useState: hook de React para guardar valores que cambian (lo que escribe el usuario, errores, etc.)
import { useState } from 'react'
import { Link } from 'react-router'
// iniciarSesion: habla con Django (src/api/auth.js)
import { iniciarSesion } from '../../api/auth'
// Mismas reglas de correo y contraseña que el backend
import { errorContrasena, errorEmail } from '../../validaciones'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false) // checkbox "Recordar"
  // Campos que el usuario ya tocó: el error de cada uno se muestra recién al salir del campo
  const [tocados, setTocados] = useState({ email: false, password: false })
  const [error, setError] = useState('') // error que devuelve el servidor
  const [loading, setLoading] = useState(false)

  const errores = { email: errorEmail(email), password: errorContrasena(password) }
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }))

  // ----- AL APRETAR "Iniciar sesión" -----
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setTocados({ email: true, password: true })
    // Las mismas reglas que valida el backend: si no se cumplen, no se envía
    if (errores.email || errores.password) {
      document.getElementById(errores.email ? 'email' : 'password')?.focus()
      return
    }
    setLoading(true)
    try {
      // "remember" se manda al backend: si es false, la sesión termina al cerrar el navegador
      const usuario = await iniciarSesion(email.trim(), password, remember)
      onIngreso?.(usuario)
    } catch (err) {
      setError(err.message || 'El correo electrónico o la contraseña son incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  const verError = (campo) => tocados[campo] && errores[campo]

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

          {/* ----- CORREO: teclado de correo, sin mayúsculas ni corrector ----- */}
          <label htmlFor="email">Correo electrónico</label>
          <div className={`login__field${verError('email') ? ' login__field--error' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={254}
              placeholder="usuario@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={tocar('email')}
              aria-invalid={Boolean(verError('email'))}
              aria-describedby={verError('email') ? 'email-error' : undefined}
            />
          </div>
          {verError('email') && (
            <p id="email-error" className="login__ayuda login__ayuda--error">
              {errores.email}
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
            <Link to="/olvide" state={{ email: email.trim() }}>
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