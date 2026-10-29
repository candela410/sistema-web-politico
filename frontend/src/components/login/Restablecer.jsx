import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { comprobarEnlace, restablecerContrasena } from '../../api/auth'
import logo from '../../assets/logo.png'
import FondoLogin from './FondoLogin'
import './Login.css'

// Pantalla del enlace que llega por correo (/restablecer/:uid/:token): elegir una
// contraseña nueva. Se ve como el login y no hace falta haber iniciado sesión.
const INCOMPLETO =
  'El enlace está incompleto. Abrilo con Ctrl + clic desde el correo, o copialo entero (puede ocupar más de una línea).'

export default function Restablecer() {
  const { uid, token } = useParams()
  const [estado, setEstado] = useState(token ? 'comprobando' : 'invalido') // comprobando | formulario | invalido | listo
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState(token ? '' : INCOMPLETO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!token) return
    comprobarEnlace(uid, token)
      .then((r) => {
        setEmail(r.email)
        setEstado('formulario')
      })
      .catch((e) => {
        setError(e.message)
        setEstado('invalido')
      })
  }, [uid, token])

  async function guardar(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('La contraseña tiene que tener al menos 8 caracteres.')
      return
    }
    if (password !== repetida) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setGuardando(true)
    try {
      await restablecerContrasena(uid, token, password)
      setEstado('listo')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const ojito = (
    <button
      type="button"
      className="login__eye"
      onClick={() => setVerPassword((v) => !v)}
      aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {verPassword && <path d="M4 4l16 16" />}
      </svg>
    </button>
  )

  const candado = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={guardar} noValidate>
          <img className="login__logo" src={logo} alt="Logo" />

          <h1>{estado === 'listo' ? 'Contraseña actualizada' : 'Restablecer contraseña'}</h1>
          <p className="login__subtitle">
            {estado === 'comprobando' && 'Comprobando el enlace…'}
            {estado === 'formulario' && (
              <>
                Elegí una contraseña nueva para <b>{email}</b>
              </>
            )}
            {estado === 'invalido' && 'No se puede usar este enlace'}
            {estado === 'listo' && 'Ya podés ingresar con tu contraseña nueva'}
          </p>
          <div className="login__bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          {estado === 'formulario' && (
            <>
              <label htmlFor="password">Contraseña nueva</label>
              <div className="login__field">
                {candado}
                <input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Al menos 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                {ojito}
              </div>

              <label htmlFor="repetida">Repetí la contraseña</label>
              <div className="login__field">
                {candado}
                <input
                  id="repetida"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />
              </div>
            </>
          )}

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          {estado === 'formulario' && (
            <button className="login__submit" type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          )}
          {(estado === 'invalido' || estado === 'listo') && (
            <Link className="login__submit login__submit--enlace" to="/login" replace>
              Ir a iniciar sesión
            </Link>
          )}
        </form>
      </section>
    </main>
  )
}
