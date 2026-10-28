import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import * as api from '../../api/encuestas'
import '../cuestionarios/cuestionarios.css'
import './responder.css'

// Vista del militante: carga una encuesta (datos de la persona + respuestas),
// con el mismo formato de tarjetas que el editor.

const ENCUESTADO_VACIO = { documento: '', nombre: '', apellido: '' }

function Pregunta({ pregunta, numero, elegidas, error, onCambio }) {
  const multiple = pregunta.tipo === 'opcion_multiple'
  const nombre = `pregunta-${pregunta.id}`

  function alternar(id) {
    if (!multiple) onCambio([id])
    else onCambio(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id])
  }

  return (
    <fieldset className={`tarjeta-form respuesta${error ? ' respuesta--error' : ''}`}>
      <legend className="respuesta__enunciado">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <span>
          {pregunta.enunciado}
          {pregunta.obligatoria && (
            <span className="respuesta__obligatoria" aria-label="obligatoria">
              {' '}
              *
            </span>
          )}
          {multiple && <span className="respuesta__ayuda">Podés elegir varias opciones</span>}
        </span>
      </legend>

      <div className="respuesta__opciones">
        {pregunta.opciones.map((o) => (
          <label key={o.id} className="respuesta__opcion">
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={nombre}
              checked={elegidas.includes(o.id)}
              onChange={() => alternar(o.id)}
            />
            <span>{o.texto}</span>
          </label>
        ))}
        {!pregunta.obligatoria && !multiple && elegidas.length > 0 && (
          <button type="button" className="enlace-boton respuesta__limpiar" onClick={() => onCambio([])}>
            Borrar selección
          </button>
        )}
      </div>

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function ResponderCuestionario() {
  const { id } = useParams()
  const [cuestionario, setCuestionario] = useState(null)
  const [encuestado, setEncuestado] = useState(ENCUESTADO_VACIO)
  const [respuestas, setRespuestas] = useState({})
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [ubicacion, setUbicacion] = useState(null)

  useEffect(() => {
    api
      .obtenerCuestionarioParaResponder(id)
      .then(setCuestionario)
      .catch((e) => setError(e.message))
  }, [id])

  // La ubicación es opcional: si el celular la da, la encuesta aparece en el mapa
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUbicacion({ latitud: p.coords.latitude, longitud: p.coords.longitude }),
      () => setUbicacion(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [enviado])

  const cambiarEncuestado = (campo) => (e) => setEncuestado((d) => ({ ...d, [campo]: e.target.value }))

  function responder(pregunta, valor) {
    setRespuestas((r) => ({ ...r, [pregunta]: valor }))
    setErrores((e) => ({ ...e, [pregunta]: '' }))
    setError('')
  }

  function validar() {
    const faltan = {}
    for (const p of cuestionario.preguntas) {
      if (p.obligatoria && !(respuestas[p.id]?.length > 0)) faltan[p.id] = 'Esta pregunta es obligatoria.'
    }
    setErrores(faltan)
    return Object.keys(faltan).length === 0
  }

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    if (!validar()) {
      setError('Revisá las preguntas marcadas en rojo.')
      return
    }
    setEnviando(true)
    try {
      await api.enviarRespuestas(id, {
        encuestado,
        respuestas: cuestionario.preguntas
          .filter((p) => respuestas[p.id]?.length > 0)
          .map((p) => ({ pregunta: p.id, opciones: respuestas[p.id] })),
        ...ubicacion,
      })
      setEnviado(true)
      window.scrollTo({ top: 0 })
      document.querySelector('.editor')?.scrollTo({ top: 0 })
    } catch (e) {
      setError(e.message)
      document.querySelector('.editor')?.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setEnviando(false)
    }
  }

  function otraEncuesta() {
    setEncuestado(ENCUESTADO_VACIO)
    setRespuestas({})
    setErrores({})
    setError('')
    setEnviado(false)
  }

  if (!cuestionario) {
    return (
      <main className="editor">
        <div className="editor__columna">
          {error ? <p className="aviso-error">{error}</p> : <p className="vacio-tarjeta">Cargando…</p>}
        </div>
      </main>
    )
  }

  if (enviado) {
    return (
      <main className="editor">
        <div className="editor__columna">
          <section className="tarjeta-form tarjeta-titulo respuesta-enviada">
            <span className="respuesta-enviada__icono" aria-hidden="true">
              ✓
            </span>
            <h1>¡Encuesta guardada!</h1>
            <p>
              Se registró la respuesta para <b>{cuestionario.titulo}</b>.
            </p>
            <div className="acciones acciones--centro">
              <Link to="/responder" className="boton boton--borde">
                Volver a encuestas
              </Link>
              <button type="button" className="boton" onClick={otraEncuesta}>
                Cargar otra encuesta
              </button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <form className="editor" onSubmit={enviar} noValidate>
      <div className="editor__barra">
        <Link to="/responder" className="enlace-volver">
          ← Encuestas
        </Link>
        <span className="editor__estado">{ubicacion ? 'Ubicación detectada' : ''}</span>
      </div>

      <div className="editor__columna">
        <section className="tarjeta-form tarjeta-titulo">
          <span className="chip-categoria">{cuestionario.categoria}</span>
          <h1 className="respuesta__titulo">{cuestionario.titulo}</h1>
          {cuestionario.descripcion && <p className="texto-suave">{cuestionario.descripcion}</p>}
          <p className="respuesta__nota">
            <span className="respuesta__obligatoria">*</span> Indica que la pregunta es obligatoria
          </p>
        </section>

        {error && (
          <p className="aviso-error" role="alert">
            {error}
          </p>
        )}

        <fieldset className="tarjeta-form datos-encuestado">
          <legend className="respuesta__enunciado">Datos de la persona encuestada</legend>
          <div className="datos-encuestado__grilla">
            <label className="datos-encuestado__ancho">
              <span>
                Documento <span className="respuesta__obligatoria">*</span>
              </span>
              <input
                className="entrada"
                inputMode="numeric"
                value={encuestado.documento}
                onChange={cambiarEncuestado('documento')}
                placeholder="Sin puntos"
                maxLength={30}
                required
              />
            </label>
            <label>
              Nombre
              <input className="entrada" value={encuestado.nombre} onChange={cambiarEncuestado('nombre')} />
            </label>
            <label>
              Apellido
              <input className="entrada" value={encuestado.apellido} onChange={cambiarEncuestado('apellido')} />
            </label>
          </div>
        </fieldset>

        {cuestionario.preguntas.map((p, i) => (
          <Pregunta
            key={p.id}
            pregunta={p}
            numero={i + 1}
            elegidas={respuestas[p.id] ?? []}
            error={errores[p.id]}
            onCambio={(v) => responder(p.id, v)}
          />
        ))}

        <div className="acciones">
          <button type="submit" className="boton boton--grande" disabled={enviando || !encuestado.documento.trim()}>
            {enviando ? 'Enviando…' : 'Enviar encuesta'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default ResponderCuestionario
