import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import Confirmacion from '../comunes/Confirmacion'
import * as api from '../../api/mapa'
import { PERFILES, distancia, duracion } from './formato'

function PanelRutas({ rutas, modo, setModo, seleccionada, onSeleccionar, onGuardada, onBorrada, onError }) {
  const [form, setForm] = useState({ nombre: '', perfil: 'foot-walking', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  const rutaActiva = rutas.find((r) => r.id === seleccionada)
  const marcando = modo?.tipo === 'ruta'
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  function empezar(ruta) {
    setForm({
      nombre: ruta?.nombre ?? '',
      perfil: ruta?.perfil ?? 'foot-walking',
      descripcion: ruta?.descripcion ?? '',
    })
    setModo({ tipo: 'ruta', id: ruta?.id, paradas: ruta?.paradas ?? [] })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    onError('')
    const datos = { ...form, paradas: modo.paradas }
    try {
      const ruta = modo.id ? await api.editarRuta(modo.id, datos) : await api.crearRuta(datos)
      onGuardada(ruta, !modo.id)
      setModo(null)
    } catch (e) {
      onError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  // Ruta que se está por borrar (abre la ventana de confirmación)
  const [aBorrar, setABorrar] = useState(null)

  async function borrar(ruta) {
    setABorrar(null)
    try {
      await api.borrarRuta(ruta.id)
      onBorrada(ruta.id)
    } catch (e) {
      onError(e.message)
    }
  }

  if (marcando) {
    const quitar = (i) => setModo((m) => ({ ...m, paradas: m.paradas.filter((_, j) => j !== i) }))
    const faltan = Math.max(0, 2 - modo.paradas.length)
    return (
      <form className="formulario" onSubmit={guardar}>
        <h2>{modo.id ? 'Editar ruta' : 'Nueva ruta'}</h2>
        <p className="paso">
          Marcá en el mapa los puntos por donde pasa la ruta, en orden. OpenRouteService calcula el recorrido por
          las calles.
        </p>

        {modo.paradas.length > 0 && (
          <ol className="paradas">
            {modo.paradas.map(([lng, lat], i) => (
              <li key={`${i}-${lng}-${lat}`}>
                <span className="paradas__numero">{i + 1}</span>
                <span className="paradas__coord">
                  {lat.toFixed(5)}, {lng.toFixed(5)}
                </span>
                <button
                  type="button"
                  className="enlace-boton"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar punto ${i + 1}`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ol>
        )}
        {faltan > 0 && (
          <p className="texto-suave">{faltan === 2 ? 'Faltan 2 puntos como mínimo.' : 'Falta 1 punto como mínimo.'}</p>
        )}

        <label htmlFor="ruta-nombre">Nombre</label>
        <input
          id="ruta-nombre"
          className="entrada"
          value={form.nombre}
          onChange={cambiar('nombre')}
          placeholder="Ej.: Recorrido del sábado"
          maxLength={120}
          required
        />

        <label htmlFor="ruta-perfil">Cómo se recorre</label>
        <select id="ruta-perfil" className="entrada" value={form.perfil} onChange={cambiar('perfil')}>
          {PERFILES.map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>

        <label htmlFor="ruta-descripcion">Notas</label>
        <textarea
          id="ruta-descripcion"
          className="entrada"
          rows={2}
          value={form.descripcion}
          onChange={cambiar('descripcion')}
        />

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={() => setModo(null)}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || faltan > 0 || !form.nombre.trim()}>
            {guardando ? 'Calculando…' : 'Calcular y guardar'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="listado">
      <button type="button" className="boton boton--ancho" onClick={() => empezar(null)}>
        + Nueva ruta
      </button>

      {rutas.length === 0 ? (
        <p className="vacio">Todavía no hay rutas. Creá una marcando los puntos sobre el mapa.</p>
      ) : (
        <ul className="items">
          {rutas.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="item"
                aria-pressed={r.id === seleccionada}
                onClick={() => onSeleccionar(r)}
              >
                <span className="item__color item__color--ruta" />
                <span className="item__texto">
                  <b>{r.nombre}</b>
                  <small>
                    {distancia(r.distancia_m)} · {duracion(r.duracion_s)} ·{' '}
                    {PERFILES.find(([v]) => v === r.perfil)?.[1].toLowerCase()}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {rutaActiva && (
        <section className="detalle">
          <h3>{rutaActiva.nombre}</h3>
          <dl className="datos">
            <dt>Distancia</dt>
            <dd>{distancia(rutaActiva.distancia_m)}</dd>
            <dt>Tiempo estimado</dt>
            <dd>{duracion(rutaActiva.duracion_s)}</dd>
            {/* Zonas y calles salen de consultas: rutas → calles → barrios → zonas */}
            <dt>{rutaActiva.zonas.length === 1 ? 'Zona' : 'Zonas'}</dt>
            <dd>{rutaActiva.zonas.length ? rutaActiva.zonas.join(', ') : 'Sin zona'}</dd>
            <dt>Calles</dt>
            <dd>{rutaActiva.calles}</dd>
            <dt>Puntos</dt>
            <dd>{rutaActiva.paradas.length}</dd>
            {rutaActiva.equipos.length > 0 && (
              <>
                <dt>Equipos</dt>
                <dd>{rutaActiva.equipos.join(', ')}</dd>
              </>
            )}
          </dl>
          {rutaActiva.descripcion && <p className="texto-suave">{rutaActiva.descripcion}</p>}
          <div className="acciones acciones-iconos">
            <BotonIcono icono={Pencil} etiqueta="Editar ruta" onClick={() => empezar(rutaActiva)} />
            <BotonIcono icono={Trash2} etiqueta="Borrar ruta" variante="peligro" onClick={() => setABorrar(rutaActiva)} />
          </div>
          {aBorrar && (
            <Confirmacion
              titulo="Borrar ruta"
              textoConfirmar="Borrar"
              onCerrar={() => setABorrar(null)}
              onConfirmar={() => borrar(aBorrar)}
            >
              ¿Seguro que querés borrar la ruta <b>{aBorrar.nombre}</b>?
            </Confirmacion>
          )}
        </section>
      )}
    </div>
  )
}

export default PanelRutas
