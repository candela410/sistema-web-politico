import Dropdown from 'react-bootstrap/Dropdown'
import { useNavigate } from 'react-router'
import { ArrowLeftRight, ChevronDown, LogOut, UserRound } from 'lucide-react'
import { inicialDe, nombreDe, rolDe } from './usuario'

// El desplegable se ubica 8px debajo del botón, alineado a la derecha.
// Sin aceleración por GPU, Popper lo ubica con top/left y deja libre
// "transform" para la animación de entrada (Menu.css).
const UBICACION = {
  modifiers: [
    { name: 'offset', options: { offset: [0, 8] } },
    { name: 'computeStyles', options: { gpuAcceleration: false } },
  ],
}

// Usuario en la barra superior; al tocarlo despliega sus datos, "Mi perfil",
// la campaña activa y "Salir".
// Es un Dropdown de react-bootstrap: se cierra con Escape o clickeando afuera
// y las opciones se recorren con las flechas del teclado.
function MenuUsuario({ usuario, onCambiarCampana, onSalir }) {
  const navegar = useNavigate()
  return (
    <Dropdown className="usuario" align="end">
      <Dropdown.Toggle as="button" type="button" bsPrefix="usuario__boton" aria-haspopup="menu">
        <span className="usuario__avatar">{inicialDe(usuario)}</span>
        <span className="usuario__texto">
          <strong>{nombreDe(usuario)}</strong>
          <small>{rolDe(usuario)}</small>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="usuario__desplegable" role="menu" popperConfig={UBICACION}>
        <p className="usuario__datos">
          <strong>{nombreDe(usuario)}</strong>
          <span>{usuario.email}</span>
        </p>
        <Dropdown.Item
          as="button"
          type="button"
          role="menuitem"
          className="usuario__accion"
          onClick={() => navegar('/perfil')}
        >
          <UserRound size={19} aria-hidden="true" />
          Mi perfil
        </Dropdown.Item>
        {usuario.campana && (
          <p className="usuario__campana">
            <span>Campaña activa</span>
            <strong>
              <span className="campana-activa__punto" aria-hidden="true" />
              {usuario.campana.nombre}
            </strong>
          </p>
        )}
        {onCambiarCampana && (
          <Dropdown.Item as="button" type="button" role="menuitem" className="usuario__accion" onClick={onCambiarCampana}>
            <ArrowLeftRight size={19} aria-hidden="true" />
            Cambiar campaña
          </Dropdown.Item>
        )}
        <Dropdown.Item
          as="button"
          type="button"
          role="menuitem"
          className="usuario__accion usuario__accion--salir"
          onClick={onSalir}
        >
          <LogOut size={19} aria-hidden="true" />
          Salir
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default MenuUsuario
