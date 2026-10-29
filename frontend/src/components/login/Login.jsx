// useState: hook de React para guardar valores que cambian (lo que escribe el usuario, errores, etc.)
import { useState } from 'react'
// iniciarSesion: la función que ya tenés en src/api/auth.js para hablar con Django
import { iniciarSesion } from '../../api/auth'
// Logo del águila (src/assets/logo.png)
import logo from '../../assets/logo.png'
// Olas de colores y foto del fondo (las comparte con Restablecer)
import FondoLogin from './FondoLogin'
// Estilos de esta pantalla
import './Login.css'

// Componente Login. Recibe "onIngreso", una función que se ejecuta cuando el login sale bien
// (App.jsx ya la usa para guardar el usuario y redirigir)
export default function Login({ onIngreso }) {
  // ----- ESTADOS -----
  const [email, setEmail] = useState('')                  // texto del campo correo
  const [password, setPassword] = useState('')            // texto del campo contraseña
  const [showPassword, setShowPassword] = useState(false) // true = se ve la contraseña (ojito)
  const [remember, setRemember] = useState(false)         // checkbox "Recordar"
  const [error, setError] = useState('')                  // mensaje de error a mostrar
  const [loading, setLoading] = useState(false)           // true mientras se espera al servidor

  // ----- FUNCIÓN QUE SE EJECUTA AL APRETAR "Iniciar sesión" -----
  async function handleSubmit(e) {
    e.preventDefault() // evita que el navegador recargue la página
    setError('')       // borra errores anteriores

    // Validación simple: si falta correo o contraseña, avisa y corta acá
    if (!email.trim() || !password) {
      setError('Ingresá tu correo y tu contraseña.')
      return
    }

    setLoading(true) // el botón pasa a "Ingresando…"
    try {
      // Django usa sesión (cookie), así que no hay token que guardar.
      // "remember" se manda al backend: si es false, la sesión termina al cerrar el navegador.
      const usuario = await iniciarSesion(email.trim(), password, remember)
      onIngreso?.(usuario) // avisa a App.jsx que el login fue exitoso
    } catch (err) {
      // Muestra el mensaje que devuelve Django (datos incorrectos, servidor caído, etc.)
      setError(err.message || 'Correo o contraseña incorrectos.')
    } finally {
      setLoading(false) // pase lo que pase, vuelve a habilitar el botón
    }
  }

  // ----- LO QUE SE DIBUJA EN PANTALLA -----
  return (
    <main className="login">

      {/* Olas de colores y foto del lado izquierdo (se comparten con Restablecer) */}
      <FondoLogin />

      {/* LADO DERECHO: logo + formulario */}
      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>

          {/* Logo del águila */}
          <img className="login__logo" src={logo} alt="Logo" />

          {/* Título y subtítulo */}
          <h1>Iniciar sesión</h1>
          <p className="login__subtitle">Accedé a tu cuenta para continuar</p>

          {/* Barrita de 4 colores debajo del título */}
          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {/* ----- CAMPO CORREO ----- */}
          <label htmlFor="email">Correo electrónico</label>
          <div className="login__field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* ----- CAMPO CONTRASEÑA ----- */}
          <label htmlFor="password">Contraseña</label>
          <div className="login__field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* Botón del ojito: alterna mostrar/ocultar la contraseña */}
            <button
              type="button"
              className="login__eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </div>

          {/* ----- FILA: checkbox "Recordar" + link "¿Olvidaste tu contraseña?" ----- */}
          <div className="login__row">
            <label className="login__check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Recordar</span>
            </label>
            {/* Por ahora el link no hace nada. Después le ponés la ruta real */}
            <a href="#" onClick={(e) => e.preventDefault()}>
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {/* Mensaje de error: solo aparece si "error" tiene texto */}
          {error && <p className="login__error" role="alert">{error}</p>}

          {/* Botón principal. Se deshabilita mientras carga para evitar doble clic */}
          <button className="login__submit" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}