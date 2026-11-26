import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { comprobarEnlace, restablecerContrasena } from '../../api/auth'
import { contrasenaValida, MENSAJE_CONTRASENA, requisitosContrasena } from '../../validaciones'
import Logo from '../comunes/Logo'
import CampoContrasena from './CampoContrasena'
import FondoLogin from './FondoLogin'
import './Login.css'

// Pantalla del enlace que llega por correo (/restablecer/:uid/:token): elegir la
// contraseña (la primera vez, desde la invitación, o una nueva). Se ve como el
// login y no hace falta haber iniciado sesión.
// La contraseña se escribe dos veces (cada campo con su ojito para verla) y las
// dos se validan mientras se escriben, sin esperar a salir del campo.
const INCOMPLETO =
  'El enlace está incompleto. Ábralo con Ctrl + clic desde el correo o cópielo completo (puede ocupar más de una línea).'

export default function Restablecer() {
  const { uid, token } = useParams()
  const [estado, setEstado] = useState(token ? 'comprobando' : 'invalido') // comprobando | formulario | invalido | listo
  const [cuenta, setCuenta] = useState('') // nombre de usuario al que pertenece el enlace
  const [nueva, setNueva] = useState(false) // true: invitación (todavía no tiene contraseña)
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [tocados, setTocados] = useState({ password: false, repetida: false })
  const [error, setError] = useState(token ? '' : INCOMPLETO)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!token) return
    comprobarEnlace(uid, token)
      .then((r) => {
        setCuenta(r.username || r.email)
        setNueva(Boolean(r.nueva))
        setEstado('formulario')
      })
      .catch((e) => {
        setError(e.message)
        setEstado('invalido')
      })
  }, [uid, token])

  const errores = {
    password: !password ? 'Ingrese la contraseña nueva.' : contrasenaValida(password) ? '' : MENSAJE_CONTRASENA,
    repetida: !repetida ? 'Repita la contraseña.' : repetida !== password ? 'Las contraseñas no coinciden.' : '',
  }
  const valores = { password, repetida }
  const verError = (campo) => (tocados[campo] || valores[campo] !== '' ? errores[campo] : '')
  const coinciden = repetida !== '' && !errores.password && !errores.repetida

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setTocados({ password: true, repetida: true })
    if (errores.password || errores.repetida) return
    setGuardando(true)
    try {
      await restablecerContrasena(uid, token, password, repetida)
      setEstado('listo')
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const titulo = {
    comprobando: 'Elegir contraseña',
    formulario: nueva ? 'Elegir contraseña' : 'Restablecer contraseña',
    invalido: 'Enlace no válido',
    listo: 'Contraseña guardada',
  }[estado]

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={guardar} noValidate>
          <Logo className="login__logo" />

          <h1>{titulo}</h1>
          <p className="login__subtitle">
            {estado === 'comprobando' && 'Comprobando el enlace…'}
            {estado === 'formulario' && (
              <>
                Elija una contraseña para el usuario <b>{cuenta}</b>
              </>
            )}
            {estado === 'invalido' && 'No se puede usar este enlace.'}
            {estado === 'listo' && (
              <>
                Ya puede ingresar con su usuario <b>{cuenta}</b> y su contraseña.
              </>
            )}
          </p>
          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {estado === 'formulario' && (
            <>
              <label htmlFor="password">Contraseña nueva</label>
              <CampoContrasena
                id="password"
                value={password}
                onChange={setPassword}
                onBlur={() => setTocados((t) => ({ ...t, password: true }))}
                autoComplete="new-password"
                enterKeyHint="next"
                error={verError('password')}
                descripcion="requisitos"
                autoFocus
              />
              <ul id="requisitos" className="login__requisitos" aria-label="Requisitos de la contraseña">
                {requisitosContrasena(password).map((r) => (
                  <li key={r.texto} className={r.ok ? 'login__requisito--ok' : ''}>
                    {r.texto}
                  </li>
                ))}
              </ul>

              <label htmlFor="repetida">Repita la contraseña</label>
              <CampoContrasena
                id="repetida"
                value={repetida}
                onChange={setRepetida}
                onBlur={() => setTocados((t) => ({ ...t, repetida: true }))}
                autoComplete="new-password"
                enterKeyHint="done"
                error={verError('repetida')}
              />
              {coinciden && (
                <p className="login__ayuda login__ayuda--ok" role="status">
                  ✓ Las contraseñas coinciden.
                </p>
              )}
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
          {estado === 'invalido' && (
            <Link className="login__volver" to="/olvide" replace>
              Solicitar un enlace nuevo
            </Link>
          )}
        </form>
      </section>
    </main>
  )
}
