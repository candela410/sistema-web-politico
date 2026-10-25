import { useState } from 'react'
import { iniciarSesion } from '../../api/auth'
import logo from '../../assets/logo.png'
import './Login.css'

function IconoCorreo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </svg>
  )
}

function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </svg>
  )
}

function IconoOjo({ tachado }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {tachado && <path d="m4 4 16 16" />}
    </svg>
  )
}

function Login({ onIngreso }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [recordar, setRecordar] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setEnviando(true)
    try {
      onIngreso(await iniciarSesion(email, password, recordar))
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <svg className="login__ola-superior" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="ola-superior-forma">
            <path d="M0 0h400v140c-40 6-80-2-110-22C250 92 215 50 160 48 105 46 60 70 0 104Z" />
          </clipPath>
        </defs>
        <path d="M0 0h400v140c-40 6-80-2-110-22C250 92 215 50 160 48 105 46 60 70 0 104Z" />
        {/* Curvas de nivel suaves, como en el diseño */}
        <g className="login__topografia" clipPath="url(#ola-superior-forma)">
          <ellipse cx="80" cy="30" rx="60" ry="22" />
          <ellipse cx="80" cy="30" rx="95" ry="38" />
          <ellipse cx="80" cy="30" rx="130" ry="55" />
          <ellipse cx="330" cy="60" rx="40" ry="18" />
          <ellipse cx="330" cy="60" rx="75" ry="34" />
          <ellipse cx="330" cy="60" rx="110" ry="52" />
        </g>
      </svg>

      <svg className="login__ola-inferior" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="ola-magenta" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--lla-violeta)" />
            <stop offset="0.6" stopColor="var(--lla-magenta)" />
            <stop offset="1" stopColor="var(--lla-naranja)" />
          </linearGradient>
        </defs>
        <path className="login__ola-violeta" d="M0 30c60-30 130-20 190 10s130 30 210 0v80H0Z" />
        <path fill="url(#ola-magenta)" d="M0 70c70-20 140 10 210 0s120-40 190-30v80H0Z" />
        <path className="login__ola-naranja" d="M250 120c40-50 90-80 150-90v90Z" />
      </svg>

      <main className="login__contenido">
        <img className="login__logo" src={logo} alt="La Libertad Avanza" />

        <header className="login__encabezado">
          <h1>Iniciar sesión</h1>
          <p>Accedé a tu cuenta para continuar</p>
          <span className="login__franja" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </header>

        <form className="login__form" onSubmit={enviar} noValidate>
          <label htmlFor="email">Correo electrónico</label>
          <div className="campo">
            <IconoCorreo />
            <input
              id="email"
              type="email"
              placeholder="ejemplo@correo.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label htmlFor="password">Contraseña</label>
          <div className="campo">
            <IconoCandado />
            <input
              id="password"
              type={verPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="campo__ver"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verPassword}
            >
              <IconoOjo tachado={verPassword} />
            </button>
          </div>

          <div className="login__opciones">
            <label className="casilla">
              <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
              <span>Recordar</span>
            </label>
            {/* Pendiente: recuperación de contraseña */}
            <a href="#" className="enlace">
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login__boton" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Iniciar sesión'}
          </button>

          <p className="login__registro">
            ¿No tenés cuenta?{' '}
            {/* Pendiente: registro de usuarios */}
            <a href="#" className="enlace enlace--fuerte">
              Registrate.
            </a>
          </p>
        </form>
      </main>
    </div>
  )
}

export default Login
