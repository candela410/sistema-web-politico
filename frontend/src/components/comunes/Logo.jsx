import logo from '../../assets/logo.png'

// Logo del sistema (imagen local del proyecto, en assets/). width y height son
// las medidas reales del archivo: el navegador reserva el lugar antes de
// cargarla y la página no salta. El tamaño en pantalla lo pone cada clase, y
// object-fit: contain (como resizeMode 'contain') lo muestra entero, sin
// recortarlo ni deformarlo. alt="" cuando el logo es solo decoración.
function Logo({ className = '', alt = 'Logo', ...resto }) {
  return (
    <img
      className={`logo ${className}`.trim()}
      src={logo}
      alt={alt}
      width={400}
      height={288}
      decoding="async"
      draggable={false}
      {...resto}
    />
  )
}

export default Logo
