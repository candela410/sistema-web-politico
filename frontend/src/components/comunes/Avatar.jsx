import { inicialDe } from '../menu/usuario'

// Círculo del usuario: su foto de perfil o, si no cargó una, su inicial.
// className es la clase del círculo (usuario__avatar, ficha__avatar...).
function Avatar({ usuario, className }) {
  return (
    <span className={`${className} avatar-foto`} aria-hidden="true">
      {usuario.foto ? <img src={usuario.foto} alt="" /> : inicialDe(usuario)}
    </span>
  )
}

export default Avatar
