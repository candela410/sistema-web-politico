import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import * as api from '../../api/campanas'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import './campanas.css'
import Esqueleto from '../comunes/Esqueleto'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'

const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })
const fecha = (iso) => (iso ? formatoFecha.format(new Date(`${iso}T12:00:00`)) : '…')

function FormularioCampana({ campana, onGuardada, onCerrar }) {
  const [form, setForm] = useState({
    nombre: campana?.nombre ?? '',
    descripcion: campana?.descripcion ?? '',
    fecha_inicio: campana?.fecha_inicio ?? '',
    fecha_fin: campana?.fecha_fin ?? '',
    activa: campana?.activa ?? true,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      onGuardada(campana ? await api.editarCampana(campana.id, form) : await api.crearCampana(form), !campana)
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
          <input className="entrada" value={form.nombre} onChange={cambiar('nombre')} maxLength={150} required autoFocus />
        </label>
        <label>
          Descripción <span className="opcional">(opcional)</span>
          <textarea className="entrada" rows={2} value={form.descripcion} onChange={cambiar('descripcion')} />
        </label>
        <div className="formulario-modal__fila">
          <label>
            Inicio
            <input className="entrada" type="date" value={form.fecha_inicio ?? ''} onChange={cambiar('fecha_inicio')} />
          </label>
          <label>
            Fin
            <input className="entrada" type="date" value={form.fecha_fin ?? ''} onChange={cambiar('fecha_fin')} />
          </label>
        </div>
        <label className="interruptor">
          <input type="checkbox" checked={form.activa} onChange={cambiar('activa')} />
          <span className="interruptor__pista" aria-hidden="true" />
          Activa (aparece para elegir al ingresar)
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
          <button type="submit" className="boton" disabled={guardando || !form.nombre.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmarBorrado({ campana, onBorrada, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)
  async function borrar() {
    setBorrando(true)
    setError('')
    try {
      await api.borrarCampana(campana.id)
      onBorrada(campana.id)
    } catch (e) {
      setError(e.message)
      setBorrando(false)
    }
  }
  return (
    <Modal titulo="Borrar campaña" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Seguro que querés borrar <b>{campana.nombre}</b>? Solo se puede si todavía no tiene datos.
      </p>
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton boton--rojo" onClick={borrar} disabled={borrando}>
          {borrando ? 'Borrando…' : 'Borrar'}
        </button>
      </div>
    </Modal>
  )
}

// Administración de campañas (superusuario o permisos de campaña)
function Campanas({ usuario }) {
  const [campanas, setCampanas] = useState(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)

  useEffect(() => {
    api
      .obtenerCampanas()
      .then(setCampanas)
      .catch((e) => setError(e.message))
  }, [])

  const puede = (accion) => tiene(usuario, `core.${accion}_campana`)

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Campañas</h1>
          <p>Cada campaña tiene sus propios usuarios, rutas y cuestionarios. Barrios y zonas son compartidos.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {puede('add') && (
          <button type="button" className="boton pagina__accion" onClick={() => setEditando('nueva')}>
            + Nueva campaña
          </button>
        )}
      </header>

      {!usuario.campana && usuario.puede_elegir_campana && (
        <p className="aviso-info">
          Todavía no elegiste una campaña. <Link to="/campana">Elegila acá</Link> para ver el resto del sistema.
        </p>
      )}

      {error ? (
        <p className="texto-error" role="alert">
          {error}
        </p>
      ) : campanas === null ? (
        <Esqueleto filas={2} />
      ) : campanas.length === 0 ? (
        <div className="vacio-tarjeta">
          <b>Todavía no hay campañas.</b>
          <span>Creá la primera con “+ Nueva campaña”.</span>
        </div>
      ) : (
        <ul className="tarjetas-lista">
          {campanas.map((c) => (
            <li key={c.id} className={`tarjeta-fila${c.activa ? '' : ' tarjeta-fila--apagada'}`}>
              <div className="tarjeta-fila__texto">
                <h3>
                  {c.nombre}
                  {usuario.campana?.id === c.id && <span className="etiqueta etiqueta--verde">Activa ahora</span>}
                  {!c.activa && <span className="etiqueta">Desactivada</span>}
                </h3>
                {c.descripcion && <p>{c.descripcion}</p>}
                <span className="tarjeta-fila__datos">
                  {fecha(c.fecha_inicio)} – {fecha(c.fecha_fin)} · {c.usuarios} usuarios · {c.cuestionarios} cuestionarios ·{' '}
                  {c.rutas} rutas
                </span>
              </div>
              <div className="tarjeta-fila__acciones acciones-iconos">
                {puede('change') && <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(c)} />}
                {puede('delete') && (
                  <BotonIcono icono={Trash2} etiqueta="Borrar" variante="peligro" onClick={() => setBorrando(c)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioCampana
          campana={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(c, nueva) => {
            setCampanas((lista) => (nueva ? [...lista, c] : lista.map((x) => (x.id === c.id ? { ...x, ...c } : x))))
            setEditando(null)
          }}
        />
      )}
      {borrando && (
        <ConfirmarBorrado
          campana={borrando}
          onCerrar={() => setBorrando(null)}
          onBorrada={(id) => {
            setCampanas((lista) => lista.filter((c) => c.id !== id))
            setBorrando(null)
          }}
        />
      )}
    </main>
  )
}

export default Campanas
