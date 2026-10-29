import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import * as api from '../../api/encuestas'
import './responder.css'
import Esqueleto from '../comunes/Esqueleto'

// Vista del militante: cuestionarios activos para cargar encuestas
function ListaResponder() {
  const [cuestionarios, setCuestionarios] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .obtenerParaResponder()
      .then(setCuestionarios)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Encuestas</h1>
          <p>Elegí el cuestionario que vas a cargar.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      {error ? (
        <p className="texto-error" role="alert">
          {error}
        </p>
      ) : cuestionarios === null ? (
        <Esqueleto filas={2} />
      ) : cuestionarios.length === 0 ? (
        <div className="vacio-tarjeta">
          <b>No hay cuestionarios activos.</b>
          <span>Cuando la administración active uno, va a aparecer acá.</span>
        </div>
      ) : (
        <ul className="responder-lista">
          {cuestionarios.map((c) => (
            <li key={c.id}>
              <Link to={`/responder/${c.id}`} className="responder-item">
                <span className="chip-categoria">{c.categoria}</span>
                <h3>{c.titulo}</h3>
                {c.descripcion && <p>{c.descripcion}</p>}
                <span className="responder-item__pie">
                  {c.preguntas === 1 ? '1 pregunta' : `${c.preguntas} preguntas`}
                  <span className="responder-item__ir">Responder →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default ListaResponder
