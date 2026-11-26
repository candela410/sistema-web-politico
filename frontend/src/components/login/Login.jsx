// useState: hook de React para guardar valores que cambian (lo que escribe el usuario, errores, etc.)
import { useState } from 'react'
import { Link } from 'react-router'
// iniciarSesion: habla con Django (src/api/auth.js)
import { iniciarSesion, ultimoUsuario } from '../../api/auth'
// Mismas reglas que el backend
import { conFiltro, errorUsuario, sinEspaciosMinusculas } from '../../validaciones'
// Logo del águila (src/assets/logo.png)
import Logo from '../comunes/Logo'
// Olas de colores y foto del fondo (las comparte con Olvide y Restablecer)
import FondoLogin from './FondoLogin'
import CampoContrasena from './CampoContrasena'
import './Login.css'
import Obligatorio from '../comunes/Obligatorio'

// Componente Login. Recibe "onIngreso", una función que se ejecuta cuando el login sale bien
// (App.jsx la usa para guardar el usuario y redirigir)
export default function Login({ onIngreso }) {
  // ----- ESTADOS -----
  // Nombre de usuario: apellido + primera letra del nombre (ej: "perezj").
  // Se propone el último que ingresó en este navegador.
  const [nombre, setNombre] = useState(ultimoUsuario)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false) // checkbox "Recordar"
  const [tocados, setTocados] = useState({ nombre: false, password: false })
  const [error, setError] = useState('') // error que devuelve el servidor
  const [loading, setLoading] = useState(false)

  // En el login solo se pide que la contraseña esté escrita: la regla de 8 caracteres,
  // mayúscula, etc. se exige al crearla. Si es incorrecta, el servidor responde
  // siempre el mismo mensaje (no dice si falló el usuario o la contraseña).
  const errores = { nombre: errorUsuario(nombre), password: password ? '' : 'Ingrese su contraseña.' }
  // "Iniciar sesión" se habilita recién cuando los dos campos tienen algo escrito
  const completo = Boolean(nombre.trim() && password)
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
      setError(err.message || 'Credenciales inválidas. Por favor, verifique su usuario y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  // Los errores aparecen recién al salir del campo o al enviar (no mientras se escribe),
  // así el formulario no cambia de tamaño con cada tecla
  const verError = (campo) => (tocados[campo] ? errores[campo] : '')

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <Logo className="login__logo" fetchPriority="high" />

          <h1>Iniciar sesión</h1>
          <p className="login__subtitle">Ingrese a su cuenta para continuar</p>

          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {/* ----- NOMBRE DE USUARIO: sin mayúsculas ni corrector ----- */}
          <label htmlFor="usuario">Usuario<Obligatorio /></label>
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
              placeholder="Usuario"
              value={nombre}
              onChange={conFiltro(sinEspaciosMinusculas, (valor) => {
                setNombre(valor)
                setTocados((t) => ({ ...t, nombre: false }))
              })}
              onBlur={tocar('nombre')}
              aria-invalid={Boolean(verError('nombre'))}
              aria-describedby={verError('nombre') ? 'usuario-error' : undefined}
            />
          </div>
          {verError('nombre') && (
            <p id="usuario-error" className="login__ayuda login__ayuda--error">
              {errores.nombre}
            </p>
          )}

          {/* ----- CONTRASEÑA: oculta, con el ojito para verla ----- */}
          <label htmlFor="password">Contraseña<Obligatorio /></label>
          <CampoContrasena
            id="password"
            value={password}
            onChange={(valor) => {
              setPassword(valor)
              setTocados((t) => ({ ...t, password: false }))
            }}
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
              ¿Olvidó su usuario o contraseña?
            </Link>
          </div>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          {/* Deshabilitado hasta completar los dos campos y mientras espera al servidor (evita el doble clic) */}
          <button className="login__submit" type="submit" disabled={loading || !completo} aria-busy={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}