import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { obtenerCategorias } from '../../api/categorias'
import * as api from '../../api/cuestionarios'
import './cuestionarios.css'
import { variableDe } from './variable'

// Editor de cuestionarios al estilo Google Forms: una tarjeta para el título
// y una tarjeta por pregunta, con sus opciones.

// Máximo de preguntas por cuestionario (el backend controla lo mismo)
const MAX_PREGUNTAS = 15

let siguienteClave = 1
const clave = () => `c${siguienteClave++}`

const nuevaOpcion = (texto = '') => ({ clave: clave(), texto })
const nuevaPregunta = () => ({
  clave: clave(),
  enunciado: '',
  tipo: 'una_opcion',
  obligatoria: false,
  opciones: [nuevaOpcion('Opción 1'), nuevaOpcion('Opción 2')],
})

function desdeServidor(c) {
  return {
    titulo: c.titulo,
    descripcion: c.descripcion,
    categoria: c.categoria,
    activo: c.activo,
    preguntas: c.preguntas.map((p) => ({
      clave: clave(),
      enunciado: p.enunciado,
      tipo: 'una_opcion',
      obligatoria: p.obligatoria,
      opciones: p.opciones.map((o) => nuevaOpcion(o.texto)),
    })),
  }
}

function paraServidor(f) {
  return {
    titulo: f.titulo,
    descripcion: f.descripcion,
    categoria: f.categoria ? Number(f.categoria) : null,
    activo: f.activo,
    preguntas: f.preguntas.map((p) => ({
      enunciado: p.enunciado,
      tipo: p.tipo,
      obligatoria: p.obligatoria,
      opciones: p.opciones.map((o) => ({ texto: o.texto })),
    })),
  }
}

function Icono({ d }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const ICONOS = {
  subir: 'M12 19V5M5 12l7-7 7 7',
  bajar: 'M12 5v14M19 12l-7 7-7-7',
  duplicar: 'M8 8h11v11H8zM5 16V5h11',
  borrar: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  quitar: 'M6 6l12 12M18 6 6 18',
}

function TarjetaPregunta({ pregunta, numero, total, activa, bloqueado, onActivar, onCambio, onMover, onDuplicar, onBorrar }) {
  const refsOpciones = useRef({})
  const [enfocar, setEnfocar] = useState(null)

  useEffect(() => {
    if (enfocar && refsOpciones.current[enfocar]) {
      refsOpciones.current[enfocar].focus()
      refsOpciones.current[enfocar].select()
      setEnfocar(null)
    }
  }, [enfocar, pregunta.opciones])

  const cambiar = (campos) => onCambio({ ...pregunta, ...campos })
  const cambiarOpcion = (c, texto) =>
    cambiar({ opciones: pregunta.opciones.map((o) => (o.clave === c ? { ...o, texto } : o)) })
  const quitarOpcion = (c) => cambiar({ opciones: pregunta.opciones.filter((o) => o.clave !== c) })
  function agregarOpcion(despuesDe) {
    const opcion = nuevaOpcion(`Opción ${pregunta.opciones.length + 1}`)
    const i = despuesDe ? pregunta.opciones.findIndex((o) => o.clave === despuesDe) + 1 : pregunta.opciones.length
    cambiar({ opciones: [...pregunta.opciones.slice(0, i), opcion, ...pregunta.opciones.slice(i)] })
    setEnfocar(opcion.clave)
  }

  return (
    <section
      className={`tarjeta-form tarjeta-pregunta${activa ? ' tarjeta-form--activa' : ''}`}
      onFocus={onActivar}
      onClick={onActivar}
      aria-label={`Pregunta ${numero}`}
    >
      {/* Arriba de la pregunta: qué tipo de variable es (se deduce de las opciones) */}
      <span className={`variable variable--${variableDe(pregunta.opciones)} tarjeta-pregunta__variable`}>
        {variableDe(pregunta.opciones) === 'cuantitativa' ? 'Cuantitativa' : 'Cualitativa'}
      </span>
      <div className="tarjeta-pregunta__cabecera">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <textarea
          className="campo-linea campo-linea--pregunta"
          rows={1}
          value={pregunta.enunciado}
          onChange={(e) => cambiar({ enunciado: e.target.value })}
          placeholder="Escribí la pregunta"
          aria-label={`Texto de la pregunta ${numero}`}
          disabled={bloqueado}
        />
      </div>

      <ul className="opciones">
        {pregunta.opciones.map((o, i) => (
          <li key={o.clave} className="opcion">
            <span className="opcion__circulo" aria-hidden="true" />
            <input
              ref={(el) => (refsOpciones.current[o.clave] = el)}
              className="campo-linea"
              value={o.texto}
              onChange={(e) => cambiarOpcion(o.clave, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  agregarOpcion(o.clave)
                }
              }}
              aria-label={`Opción ${i + 1} de la pregunta ${numero}`}
              disabled={bloqueado}
            />
            {!bloqueado && pregunta.opciones.length > 2 && (
              <button
                type="button"
                className="boton-icono"
                onClick={() => quitarOpcion(o.clave)}
                aria-label={`Quitar opción ${i + 1}`}
                title="Quitar opción"
              >
                <Icono d={ICONOS.quitar} />
              </button>
            )}
          </li>
        ))}
        {!bloqueado && (
          <li className="opcion">
            <span className="opcion__circulo" aria-hidden="true" />
            <button type="button" className="opcion__agregar" onClick={() => agregarOpcion()}>
              Agregar opción
            </button>
          </li>
        )}
      </ul>

      <footer className="tarjeta-pregunta__pie">
        <label className="interruptor">
          <input
            type="checkbox"
            checked={pregunta.obligatoria}
            onChange={(e) => cambiar({ obligatoria: e.target.checked })}
            disabled={bloqueado}
          />
          <span className="interruptor__pista" aria-hidden="true" />
          Obligatoria
        </label>
        {!bloqueado && (
          <div className="tarjeta-pregunta__herramientas">
            <button type="button" className="boton-icono" onClick={() => onMover(-1)} disabled={numero === 1} aria-label="Subir pregunta" title="Subir">
              <Icono d={ICONOS.subir} />
            </button>
            <button type="button" className="boton-icono" onClick={() => onMover(1)} disabled={numero === total} aria-label="Bajar pregunta" title="Bajar">
              <Icono d={ICONOS.bajar} />
            </button>
            <button type="button" className="boton-icono" onClick={onDuplicar} aria-label="Duplicar pregunta" title="Duplicar">
              <Icono d={ICONOS.duplicar} />
            </button>
            <button type="button" className="boton-icono boton-icono--peligro" onClick={onBorrar} disabled={total === 1} aria-label="Borrar pregunta" title="Borrar">
              <Icono d={ICONOS.borrar} />
            </button>
          </div>
        )}
      </footer>
    </section>
  )
}

function EditorCuestionario() {
  const { id } = useParams()
  const esNuevo = !id
  const navegar = useNavigate()

  const [form, setForm] = useState(
    esNuevo ? { titulo: '', descripcion: '', categoria: '', activo: true, preguntas: [nuevaPregunta()] } : null,
  )
  const [bloqueado, setBloqueado] = useState(false)
  const [encuestas, setEncuestas] = useState(0)
  const [categorias, setCategorias] = useState(null)
  const [activa, setActiva] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [sinGuardar, setSinGuardar] = useState(false)
  const refsPreguntas = useRef({})

  useEffect(() => {
    obtenerCategorias()
      .then(setCategorias)
      .catch((e) => setError(e.message))
    if (!esNuevo) {
      api
        .obtenerCuestionario(id)
        .then((c) => {
          setForm(desdeServidor(c))
          setBloqueado(c.bloqueado)
          setEncuestas(c.encuestas)
        })
        .catch((e) => setError(e.message))
    }
  }, [id, esNuevo])

  // Avisa antes de cerrar la pestaña si hay cambios sin guardar
  useEffect(() => {
    if (!sinGuardar) return
    const avisar = (e) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sinGuardar])

  function actualizar(cambios) {
    setForm((f) => ({ ...f, ...cambios }))
    setSinGuardar(true)
  }

  const cambiarPregunta = (p) => actualizar({ preguntas: form.preguntas.map((x) => (x.clave === p.clave ? p : x)) })

  function insertarPregunta(pregunta, despuesDe) {
    if (form.preguntas.length >= MAX_PREGUNTAS) return
    const i = despuesDe ? form.preguntas.findIndex((p) => p.clave === despuesDe) + 1 : form.preguntas.length
    actualizar({ preguntas: [...form.preguntas.slice(0, i), pregunta, ...form.preguntas.slice(i)] })
    setActiva(pregunta.clave)
    // Lleva la vista y el foco a la pregunta nueva
    setTimeout(() => {
      const tarjeta = refsPreguntas.current[pregunta.clave]
      tarjeta?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      tarjeta?.querySelector('textarea')?.focus({ preventScroll: true })
    }, 0)
  }

  function mover(c, paso) {
    const lista = [...form.preguntas]
    const i = lista.findIndex((p) => p.clave === c)
    ;[lista[i], lista[i + paso]] = [lista[i + paso], lista[i]]
    actualizar({ preguntas: lista })
  }

  function duplicar(p) {
    insertarPregunta({ ...p, clave: clave(), opciones: p.opciones.map((o) => nuevaOpcion(o.texto)) }, p.clave)
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const datos = paraServidor(form)
      const guardado = esNuevo ? await api.crearCuestionario(datos) : await api.guardarCuestionario(id, datos)
      setSinGuardar(false)
      navegar('/cuestionarios', {
        state: { aviso: esNuevo ? `Cuestionario “${guardado.titulo}” creado.` : 'Cambios guardados.' },
      })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.querySelector('.editor')?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!form) {
    return <main className="editor">{error ? <p className="texto-error">{error}</p> : <p className="vacio-tarjeta">Cargando…</p>}</main>
  }

  return (
    <form className="editor" onSubmit={guardar}>
      <div className="editor__barra">
        <Link to="/cuestionarios" className="enlace-volver">
          ← Cuestionarios
        </Link>
        <span className="editor__estado">{sinGuardar ? 'Cambios sin guardar' : ''}</span>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : esNuevo ? 'Crear cuestionario' : 'Guardar cambios'}
        </button>
      </div>

      <div className="editor__columna">
        {error && (
          <p className="aviso-error" role="alert">
            {error}
          </p>
        )}
        {bloqueado && (
          <p className="aviso-info">
            Este cuestionario ya tiene {encuestas === 1 ? '1 encuesta cargada' : `${encuestas} encuestas cargadas`}.
            Podés cambiar el título, la descripción, la categoría y si está activo, pero no las preguntas.
          </p>
        )}

        <section className="tarjeta-form tarjeta-titulo">
          <input
            className="campo-linea campo-linea--titulo"
            value={form.titulo}
            onChange={(e) => actualizar({ titulo: e.target.value })}
            placeholder="Título del cuestionario"
            aria-label="Título del cuestionario"
            maxLength={180}
            required
          />
          <textarea
            className="campo-linea"
            rows={2}
            value={form.descripcion}
            onChange={(e) => actualizar({ descripcion: e.target.value })}
            placeholder="Descripción (opcional)"
            aria-label="Descripción"
          />
          <div className="tarjeta-titulo__ajustes">
            <label className="tarjeta-titulo__campo">
              Categoría
              <select
                className="entrada"
                value={form.categoria}
                onChange={(e) => actualizar({ categoria: e.target.value })}
                required
              >
                <option value="">Elegí una categoría</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="interruptor">
              <input type="checkbox" checked={form.activo} onChange={(e) => actualizar({ activo: e.target.checked })} />
              <span className="interruptor__pista" aria-hidden="true" />
              Activo
            </label>
          </div>
          {categorias?.length === 0 && (
            <p className="texto-suave">
              No hay categorías todavía. <Link to="/categorias">Creá una en Categorías</Link>.
            </p>
          )}
        </section>

        {form.preguntas.map((p, i) => (
          <div key={p.clave} ref={(el) => (refsPreguntas.current[p.clave] = el)}>
            <TarjetaPregunta
              pregunta={p}
              numero={i + 1}
              total={form.preguntas.length}
              activa={activa === p.clave}
              bloqueado={bloqueado}
              onActivar={() => setActiva(p.clave)}
              onCambio={cambiarPregunta}
              onMover={(paso) => mover(p.clave, paso)}
              onDuplicar={() => duplicar(p)}
              onBorrar={() => actualizar({ preguntas: form.preguntas.filter((x) => x.clave !== p.clave) })}
            />
          </div>
        ))}

        {!bloqueado &&
          (form.preguntas.length < MAX_PREGUNTAS ? (
            <button
              type="button"
              className="agregar-pregunta"
              onClick={() => insertarPregunta(nuevaPregunta(), activa)}
            >
              + Agregar pregunta ({form.preguntas.length} de {MAX_PREGUNTAS})
            </button>
          ) : (
            <p className="aviso-info">Llegaste al máximo de {MAX_PREGUNTAS} preguntas por cuestionario.</p>
          ))}
      </div>
    </form>
  )
}

export default EditorCuestionario
