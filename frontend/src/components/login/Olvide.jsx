import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { pedirEnlace, ultimoUsuario } from '../../api/auth'
import { errorUsuario } from '../../validaciones'
import logo from '../../assets/logo.png'
import FondoLogin from './FondoLogin'
import './Login.css'

// "¿Olvidó su contraseña?" (/olvide): la persona confirma su nombre de usuario
// (ya viene escrito: el que puso en el login o el último que ingresó en este
// navegador) y el enlace para elegir una contraseña nueva se envía al correo
// asociado a ese usuario. La respuesta es siempre la misma, exista o no.
export default function Olvide() {
  const { state } = useLocation()
  const [nombre, setNombre] = useState(() => state?.usuario || ultimoUsuario())
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errorCampo = errorUsuario(nombre)
  // El error se muestra mientras se escribe
  const verError = (tocado || nombre !== '') && errorCampo

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setTocado(true)
    if (errorCampo) {
      document.getElementById('usuario')?.focus()
      return
    }
    setEnviando(true)
    try {
      const r = await pedirEnlace(nombre.trim())
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
              : 'Enviaremos al correo asociado a su usuario un enlace para elegir una contraseña nueva.'}
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
              <label htmlFor="usuario">Nombre de usuario</label>
              <div className={`login__field${verError ? ' login__field--error' : ''}`}>
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
                  enterKeyHint="send"
                  maxLength={254}
                  placeholder="apellido + inicial del nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onBlur={() => setTocado(true)}
                  autoFocus
                  aria-invalid={Boolean(verError)}
                  aria-describedby={verError ? 'usuario-error' : 'usuario-ayuda'}
                />
              </div>
              {verError ? (
                <p id="usuario-error" className="login__ayuda login__ayuda--error">
                  {errorCampo}
                </p>
              ) : (
                <p id="usuario-ayuda" className="login__ayuda">
                  Su apellido y la primera letra de su nombre. Ejemplo: Juan Pérez → <b>perezj</b>
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
