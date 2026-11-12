import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import * as api from '../../api/campanas'
import logo from '../../assets/logo.png'
import { tiene } from '../../permisos'
import { useConCambios } from '../../validaciones'
import BotonIcono from '../comunes/BotonIcono'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import './campanas.css'

// Crear o editar una campaña (nombre, descripción y si está activa)
function FormularioCampana({ campana, onGuardada, onCerrar }) {
  const [form, setForm] = useState({
    nombre: campana?.nombre ?? '',
    descripcion: campana?.descripcion ?? '',
    activa: campana?.activa ?? true,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      onGuardada(campana ? await api.editarCampana(campana.id, form) : await api.crearCampana(form))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={campana ? 'Editar campaña' : 'Nueva campaña'} onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar}>
        <label>
          Nombre
          <input
            className="entrada"
            value={form.nombre}
            onChange={cambiar('nombre')}
            maxLength={150}
            autoCapitalize="sentences"
            enterKeyHint="next"
            required
            autoFocus
          />
        </label>
        <label>
          Descripción
          <textarea className="entrada" rows={2} value={form.descripcion} onChange={cambiar('descripcion')} maxLength={500} />
        </label>
        <label className="interruptor">
          <input type="checkbox" checked={form.activa} onChange={cambiar('activa')} />
          <span className="interruptor__pista" aria-hidden="true" />
          Activa
        </label>
        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !form.nombre.trim() || !conCambios}>
            {guardando ? 'Guardando…' : campana ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const resumen = (c) =>
  `${c.cuestionarios} cuestionario${c.cuestionarios === 1 ? '' : 's'} · ${c.usuarios} usuario${
    c.usuarios === 1 ? '' : 's'
  } · ${c.rutas} ruta${c.rutas === 1 ? '' : 's'}`

// Pantalla que ve quien puede elegir la campaña después de ingresar: elige la
// campaña y recién ahí se abre el menú con todo lo de esa campaña. Acá mismo se
// crean campañas nuevas y se activan o desactivan (ya no hay sección Campañas).
function ElegirCampana({ usuario, onElegida, onSalir }) {
  const [campanas, setCampanas] = useState(null)
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(null)
  const [editando, setEditando] = useState(null) // null | 'nueva' | campaña
  const puedeCrear = tiene(usuario, 'core.add_campana')
  const puedeEditar = tiene(usuario, 'core.change_campana')

  useEffect(() => {
    // Todas las campañas, también las desactivadas (para poder reactivarlas)
    api
      .obtenerCampanas()
      .then(setCampanas)
      .catch((e) => setError(e.message))
  }, [])

  const activas = (campanas ?? []).filter((c) => c.activa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const inactivas = (campanas ?? []).filter((c) => !c.activa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const paginado = usePaginado(activas)

  async function entrar(campana) {
    setError('')
    setEntrando(campana.id)
    try {
      onElegida(await api.elegirCampana(campana.id))
    } catch (e) {
      setError(e.message)
      setEntrando(null)
    }
  }

  function guardada(campana) {
    setCampanas((lista) => {
      const sin = (lista ?? []).filter((c) => c.id !== campana.id)
      const anterior = (lista ?? []).find((c) => c.id === campana.id)
      // Al crear o editar, el servidor no manda los conteos: se conservan los que había
      return [...sin, { cuestionarios: 0, usuarios: 0, rutas: 0, ...anterior, ...campana }]
    })
    setEditando(null)
  }

  return (
    <div className="elegir">
      <svg className="elegir__ola" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0h400v140c-40 6-80-2-110-22C250 92 215 50 160 48 105 46 60 70 0 104Z" />
      </svg>

      <main className="elegir__contenido">
        <img className="elegir__logo" src={logo} alt="Logo" />
        <header className="elegir__encabezado">
          <div>
            <h1>Seleccione la campaña</h1>
            <p>
              Bienvenido/a, {usuario.nombre || usuario.email}. Seleccione la campaña en la que va a trabajar: se
              mostrarán solo sus datos.
            </p>
            <span className="franja-corta" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          {puedeCrear && (
            <button type="button" className="boton" onClick={() => setEditando('nueva')}>
              <Plus size={17} aria-hidden="true" />
              Nueva campaña
            </button>
          )}
        </header>

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        {campanas === null ? (
          <p className="vacio-tarjeta">Cargando…</p>
        ) : activas.length === 0 ? (
          <div className="vacio-tarjeta">
            <b>No hay campañas activas.</b>
            <span>{puedeCrear ? 'Cree una campaña para comenzar.' : 'Solicite a la administración que cree una.'}</span>
          </div>
        ) : (
          <>
            <ul className="elegir__lista">
              {paginado.items.map((c) => (
                <li key={c.id} className="elegir__item">
                  <button
                    type="button"
                    className="elegir__campana"
                    onClick={() => entrar(c)}
                    disabled={entrando !== null}
                    aria-busy={entrando === c.id}
                  >
                    <span className="elegir__nombre">{c.nombre}</span>
                    {c.descripcion && <span className="elegir__descripcion">{c.descripcion}</span>}
                    <span className="elegir__datos">
                      <span>{resumen(c)}</span>
                    </span>
                    <span className="elegir__entrar" aria-hidden="true">
                      {entrando === c.id ? 'Ingresando…' : 'Ingresar →'}
                    </span>
                  </button>
                  {puedeEditar && (
                    <BotonIcono
                      icono={Pencil}
                      etiqueta={`Editar ${c.nombre}`}
                      ayuda="Editar o desactivar"
                      className="elegir__editar"
                      onClick={() => setEditando(c)}
                    />
                  )}
                </li>
              ))}
            </ul>
            <Paginacion {...paginado} contenedor="html" />
          </>
        )}

        {inactivas.length > 0 && (
          <section className="elegir__inactivas" aria-labelledby="titulo-inactivas">
            <h2 id="titulo-inactivas">Campañas desactivadas</h2>
            <ul>
              {inactivas.map((c) => (
                <li key={c.id}>
                  <span>
                    <b>{c.nombre}</b>
                    <small>{resumen(c)}</small>
                  </span>
                  {puedeEditar && (
                    <button type="button" className="boton boton--borde boton--chico" onClick={() => setEditando(c)}>
                      Editar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="elegir__pie">
          <button type="button" className="enlace-boton" onClick={onSalir}>
            Cerrar sesión
          </button>
        </footer>
      </main>

      {editando && (
        <FormularioCampana
          campana={editando === 'nueva' ? null : editando}
          onGuardada={guardada}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

export default ElegirCampana
