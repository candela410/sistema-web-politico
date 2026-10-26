import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { inicialDe, nombreDe, rolDe } from './usuario'

// Usuario en la barra superior; al tocarlo despliega sus datos y "Salir"
function MenuUsuario({ usuario, onSalir }) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const alClickear = (e) => !caja.current?.contains(e.target) && setAbierto(false)
    const alTeclear = (e) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', alClickear)
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('mousedown', alClickear)
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  return (
    <div className="usuario" ref={caja}>
      <button
        type="button"
        className="usuario__boton"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        <span className="usuario__avatar">{inicialDe(usuario)}</span>
        <span className="usuario__texto">
          <strong>{nombreDe(usuario)}</strong>
          <small>{rolDe(usuario)}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="usuario__desplegable" role="menu">
          <p className="usuario__datos">
            <strong>{nombreDe(usuario)}</strong>
            <span>{usuario.email}</span>
          </p>
          <button type="button" role="menuitem" className="usuario__salir" onClick={onSalir}>
            <LogOut size={19} aria-hidden="true" />
            Salir
          </button>
        </div>
      )}
    </div>
  )
}

export default MenuUsuario
