import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { pedirEnlace, pedirUsuario, ultimoUsuario } from '../../api/auth'
import { conFiltro, errorEmail, errorUsuario, sinEspaciosMinusculas } from '../../validaciones'
import Logo from '../comunes/Logo'
import Obligatorio from '../comunes/Obligatorio'
import FondoLogin from './FondoLogin'
import './Login.css'

// "¿Olvidó su contraseña o su usuario?" (/olvide). Se elige qué se quiere recuperar:
// - La contraseña: se confirma el nombre de usuario (ya viene escrito) y se envía
//   al correo asociado un enlace para elegir una contraseña nueva.
// - El usuario: se escribe el correo y se envía a ese correo el nombre de usuario.
// En los dos casos la respuesta es siempre la misma, exista o no la cuenta.
const OPCIONES = {
  contrasena: {
    titulo: 'Recuperar contraseña',
    ayuda: 'Enviaremos al correo asociado a su usuario un enlace para elegir una contraseña nueva.',
    listo: 'El enlace vence en 24 horas y sirve una sola vez.',
    boton: 'Enviar enlace',
  },
  usuario: {
    titulo: 'Recuperar usuario',
    ayuda: 'Escriba el correo de su cuenta y le enviaremos su nombre de usuario.',
    listo: 'Con ese nombre de usuario y su contraseña puede volver a ingresar.',
    boton: 'Enviar mi usuario',
  },
}

const IconoUsuario = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

const IconoCorreo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)

export default function Olvide() {
  const { state } = useLocation()
  const [que, setQue] = useState(state?.que === 'usuario' ? 'usuario' : 'contrasena')
  const [nombre, setNombre] = useState(() => state?.usuario || ultimoUsuario())
  const [email, setEmail] = useState('')
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState('')
  const [enviando, setEnviando] = useState(false)

  const opcion = OPCIONES[que]
  const porUsuario = que === 'contrasena'
  const valor = porUsuario ? nombre : email
  const errorCampo = porUsuario ? errorUsuario(nombre) : errorEmail(email)
  // El error se muestra mientras se escribe
  const verError = (tocado || valor !== '') && errorCampo

  function elegir(nueva) {
    setQue(nueva)
    setTocado(false)
    setError('')
  }

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setTocado(true)
    if (errorCampo) {
      document.getElementById('dato')?.focus()
      return
    }
    setEnviando(true)
    try {
      const r = porUsuario ? await pedirEnlace(nombre.trim()) : await pedirUsuario(email.trim())
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
          <Logo className="login__logo" />

          <h1>{enviado ? 'Revise su correo' : opcion.titulo}</h1>
          <p className="login__subtitle">{enviado ? opcion.listo : opcion.ayuda}</p>
          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {enviado ? (
            <p className="login__ok" role="status">
              {enviado}
            </p>
          ) : (
            <>
              {/* Qué quiere recuperar: la contraseña o el nombre de usuario */}
              <div className="login__elegir" role="radiogroup" aria-label="¿Qué olvidó?">
                {[
                  ['contrasena', 'Mi contraseña'],
                  ['usuario', 'Mi usuario'],
                ].map(([clave, texto]) => (
                  <button
                    key={clave}
                    type="button"
                    role="radio"
                    aria-checked={que === clave}
                    className={`login__elegir-opcion${que === clave ? ' login__elegir-opcion--activa' : ''}`}
                    onClick={() => elegir(clave)}
                  >
                    {texto}
                  </button>
                ))}
              </div>

              <label htmlFor="dato">
                {porUsuario ? 'Nombre de usuario' : 'Correo electrónico'}
                <Obligatorio />
              </label>
              <div className={`login__field${verError ? ' login__field--error' : ''}`}>
                {porUsuario ? <IconoUsuario /> : <IconoCorreo />}
                <input
                  key={que}
                  id="dato"
                  type={porUsuario ? 'text' : 'email'}
                  inputMode={porUsuario ? 'text' : 'email'}
                  autoComplete={porUsuario ? 'username' : 'email'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  maxLength={254}
                  placeholder={porUsuario ? 'Ingrese su usuario' : 'usuario@correo.com'}
                  value={valor}
                  onChange={conFiltro(sinEspaciosMinusculas, porUsuario ? setNombre : setEmail)}
                  onBlur={() => setTocado(true)}
                  autoFocus
                  aria-invalid={Boolean(verError)}
                  aria-describedby={verError ? 'dato-error' : 'dato-ayuda'}
                />
              </div>
              {verError ? (
                <p id="dato-error" className="login__ayuda login__ayuda--error">
                  {errorCampo}
                </p>
              ) : (
                <p id="dato-ayuda" className="login__ayuda">
                  {porUsuario ? (
                    <>
                      Su apellido y la primera letra de su nombre. Ejemplo: Juan Pérez → <b>perezj</b>
                    </>
                  ) : (
                    'El mismo correo con el que le crearon la cuenta.'
                  )}
                </p>
              )}

              {error && (
                <p className="login__error" role="alert">
                  {error}
                </p>
              )}

              <button className="login__submit" type="submit" disabled={enviando || Boolean(errorCampo)} aria-busy={enviando}>
                {enviando ? 'Enviando…' : opcion.boton}
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
