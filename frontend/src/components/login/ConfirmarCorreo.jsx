import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { confirmarCorreo, prepararCsrf, usuarioActual } from '../../api/auth'
import Logo from '../comunes/Logo'
import FondoLogin from './FondoLogin'
import './Login.css'

// Pantalla del enlace que llega al correo nuevo (/confirmar-correo/:token)
// después de cambiarlo en Mi perfil. Al abrirla se confirma el correo y recién
// ahí se guarda. Se ve como el login y no hace falta haber iniciado sesión.
// usuario / onCambio: la sesión de la app, para mostrar el correo nuevo al volver.
export default function ConfirmarCorreo({ usuario, onCambio }) {
  const { token } = useParams()
  const [estado, setEstado] = useState(token ? 'comprobando' : 'invalido') // comprobando | listo | invalido
  const [correo, setCorreo] = useState('')
  const [error, setError] = useState(
    token ? '' : 'El enlace está incompleto. Ábralo desde el correo o cópielo completo.',
  )
  // En desarrollo React monta dos veces: el enlace se usa una sola vez
  const enviado = useRef(false)

  useEffect(() => {
    if (!token || enviado.current) return
    enviado.current = true
    prepararCsrf()
      .then(() => confirmarCorreo(token))
      .then(async (r) => {
        setCorreo(r.email)
        setEstado('listo')
        // Si la sesión está abierta, la app pasa a mostrar el correo nuevo
        const actual = await usuarioActual().catch(() => null)
        if (actual) onCambio?.(actual)
      })
      .catch((e) => {
        setError(e.message)
        setEstado('invalido')
      })
  }, [token, onCambio])

  const titulo = { comprobando: 'Confirmando su correo', listo: 'Correo confirmado', invalido: 'Enlace no válido' }[estado]

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <div className="login__form">
          <Logo className="login__logo" />

          <h1>{titulo}</h1>
          <p className="login__subtitle" role={estado === 'comprobando' ? 'status' : undefined}>
            {estado === 'comprobando' && 'Un momento…'}
            {estado === 'listo' && (
              <>
                Su cuenta ahora usa el correo <b>{correo}</b>. A él le llegarán los avisos y los enlaces para cambiar
                la contraseña.
              </>
            )}
            {estado === 'invalido' && 'No se pudo confirmar el correo.'}
          </p>
          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          {estado !== 'comprobando' &&
            (usuario ? (
              <Link className="login__submit login__submit--enlace" to="/configuracion" replace>
                Volver a Mi perfil
              </Link>
            ) : (
              <Link className="login__submit login__submit--enlace" to="/login" replace>
                Ir a iniciar sesión
              </Link>
            ))}
        </div>
      </section>
    </main>
  )
}
