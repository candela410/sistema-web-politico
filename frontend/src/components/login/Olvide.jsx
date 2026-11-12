import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { pedirEnlace } from '../../api/auth'
import { errorEmail } from '../../validaciones'
import logo from '../../assets/logo.png'
import FondoLogin from './FondoLogin'
import './Login.css'

// "¿Olvidó su contraseña?" (/olvide): la persona escribe su correo y, si es
// de un usuario activo, le llega el enlace para elegir una contraseña nueva.
// La respuesta es siempre la misma, exista o no el correo.
export default function Olvide() {
  const { state } = useLocation()
  const [email, setEmail] = useState(state?.email ?? '')
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errorCampo = errorEmail(email)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setTocado(true)
    if (errorCampo) {
      document.getElementById('email')?.focus()
      return
    }
    setEnviando(true)
    try {
      const r = await pedirEnlace(email.trim())
      setEnviado(r.mensaje)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={enviar} noValidate>
          <img className="login__logo" src={logo} alt="Logo" />

          <h1>{enviado ? 'Revise su correo' : 'Recuperar contraseña'}</h1>
          <p className="login__subtitle">
            {enviado
              ? 'El enlace vence en 24 horas y sirve una sola vez.'
              : 'Ingrese su correo y le enviaremos un enlace para elegir una contraseña nueva.'}
          </p>
          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {enviado ? (
            <p className="login__ok" role="status">
              {enviado}
            </p>
          ) : (
            <>
              <label htmlFor="email">Correo electrónico</label>
              <div className={`login__field${tocado && errorCampo ? ' login__field--error' : ''}`}>
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
                  enterKeyHint="send"
                  maxLength={254}
                  placeholder="usuario@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTocado(true)}
                  autoFocus
                  aria-invalid={Boolean(tocado && errorCampo)}
                  aria-describedby={tocado && errorCampo ? 'email-error' : undefined}
                />
              </div>
              {tocado && errorCampo && (
                <p id="email-error" className="login__ayuda login__ayuda--error">
                  {errorCampo}
                </p>
              )}

              {error && (
                <p className="login__error" role="alert">
                  {error}
                </p>
              )}

              <button className="login__submit" type="submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </>
          )}

          <Link className="login__volver" to="/login" replace>
            ← Volver a iniciar sesión
          </Link>
        </form>
      </section>
    </main>
  )
}
