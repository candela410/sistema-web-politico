import { useState } from 'react'
import { inicialDe } from '../menu/usuario'
import './Avatar.css'

// Círculo del usuario: su foto de perfil o, si no cargó una, su inicial.
// className es la clase del círculo (usuario__avatar, ficha__avatar...).
// Si la foto no se puede mostrar (onError), queda la inicial en su lugar.
function Avatar({ usuario, className }) {
  const [fallo, setFallo] = useState(null)
  const conFoto = Boolean(usuario.foto) && fallo !== usuario.foto
  return (
    <span className={`${className} avatar-foto`} aria-hidden="true">
      {conFoto ? (
        <img
          src={usuario.foto}
          alt=""
          width={256}
          height={256}
          decoding="async"
          draggable={false}
          onError={() => setFallo(usuario.foto)}
        />
      ) : (
        inicialDe(usuario)
      )}
    </span>
  )
}

export default Avatar
