import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { guardarPreferencia, obtenerPreferencias } from '../../api/avisos'
import Esqueleto from '../comunes/Esqueleto'
import Interruptor from '../comunes/Interruptor'

// Configuración → Notificaciones: cada usuario elige qué avisos de la campanita
// quiere recibir. Solo se muestran los que le pueden llegar según su rol. Cada
// cambio se guarda al instante.
function Notificaciones() {
  const [preferencias, setPreferencias] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerPreferencias()
      .then(setPreferencias)
      .catch((e) => setError(e.message))
  }, [])

  async function cambiar(tipo, recibir) {
    setError('')
    try {
      setPreferencias(await guardarPreferencia(tipo, recibir))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section className="tarjeta-form config-notificaciones" aria-labelledby="config-notificaciones-titulo">
      <div className="config-notificaciones__encabezado">
        <span className="config-notificaciones__icono" aria-hidden="true">
          <BellRing size={20} />
        </span>
        <div>
          <h2 id="config-notificaciones-titulo">Notificaciones</h2>
          <p>Elija qué avisos quiere recibir en la campanita de la barra superior.</p>
        </div>
      </div>

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      {!preferencias ? (
        !error && <Esqueleto filas={3} />
      ) : (
        <ul className="config-notificaciones__lista">
          {preferencias.map((p) => (
            <li key={p.tipo} className="config-notificaciones__item">
              <div>
                <strong>{p.nombre}</strong>
                <span>{p.descripcion}</span>
              </div>
              <Interruptor
                activo={p.recibir}
                onCambiar={(recibir) => cambiar(p.tipo, recibir)}
                etiqueta={`Recibir avisos de ${p.nombre.toLowerCase()}`}
                textos={['Recibir', 'No recibir']}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default Notificaciones
