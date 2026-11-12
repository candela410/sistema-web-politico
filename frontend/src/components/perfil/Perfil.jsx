import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { pedirCambioDeContrasena, usuarioActual } from '../../api/auth'
import AvisoOk from '../comunes/AvisoOk'
import Confirmacion from '../comunes/Confirmacion'
import FichaUsuario from './FichaUsuario'

// Mi perfil: los datos del usuario que inició sesión y "Cambiar contraseña",
// que le envía a su correo un enlace para elegir una nueva.
function Perfil({ usuario }) {
  const [datos, setDatos] = useState(usuario)
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  // Datos frescos (por si cambiaron desde que se inició sesión)
  useEffect(() => {
    usuarioActual()
      .then((u) => u && setDatos(u))
      .catch(() => {})
  }, [])

  async function cambiarContrasena() {
    setError('')
    try {
      const r = await pedirCambioDeContrasena()
      setAviso(`Se envió a ${r.email} un enlace para elegir una contraseña nueva. Revise su correo.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Mi perfil</h1>
          <p>Sus datos en el sistema.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <button type="button" className="boton pagina__accion" onClick={() => setConfirmando(true)}>
          <KeyRound size={18} aria-hidden="true" />
          Cambiar contraseña
        </button>
      </header>

      {aviso && <AvisoOk>{aviso}</AvisoOk>}
      {error && (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      )}

      <FichaUsuario usuario={datos} campana={datos.campana?.nombre ?? ''} />

      {confirmando && (
        <Confirmacion
          titulo="Cambiar contraseña"
          textoConfirmar="Enviar enlace"
          peligro={false}
          onCerrar={() => setConfirmando(false)}
          onConfirmar={cambiarContrasena}
        >
          Se enviará a <b>{datos.email}</b> un enlace para elegir una contraseña nueva. Su contraseña actual sigue
          funcionando hasta que elija la nueva.
        </Confirmacion>
      )}
    </main>
  )
}

export default Perfil
