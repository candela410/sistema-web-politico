import { useState } from 'react'
import Fade from 'react-bootstrap/Fade'

// Mensaje de "listo" de las listas ("Usuario guardado", "Rol borrado"…).
// Aparece con un desplazamiento corto y, cuando la pantalla lo borra, se
// desvanece en lugar de desaparecer de golpe (ver .aviso-ok en movimiento.css).
//   <AvisoOk>{aviso}</AvisoOk>   con aviso = '' no se muestra nada
function AvisoOk({ children }) {
  // Se guarda el último texto para seguir mostrándolo mientras se desvanece
  const [ultimo, setUltimo] = useState(children)
  if (children && children !== ultimo) setUltimo(children)

  return (
    <Fade in={Boolean(children)} appear mountOnEnter unmountOnExit>
      <p className="aviso-ok" role="status">
        {children || ultimo}
      </p>
    </Fade>
  )
}

export default AvisoOk
