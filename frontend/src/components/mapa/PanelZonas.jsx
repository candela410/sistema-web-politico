import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import Confirmacion from '../comunes/Confirmacion'
import * as api from '../../api/mapa'
import { COLORES_ZONA } from './formato'

function SelectorColor({ valor, onCambio }) {
  return (
    <div className="colores" role="radiogroup" aria-label="Color de la zona">
      {COLORES_ZONA.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor === c}
          aria-label={c}
          className="colores__item"
          style={{ background: c }}
          onClick={() => onCambio(c)}
        />
      ))}
    </div>
  )
}

function PanelZonas({ zonas, modo, setModo, seleccionada, onSeleccionar, onGuardada, onBorrada, onError }) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_ZONA[0])
  const [guardando, setGuardando] = useState(false)

  const zonaActiva = zonas.find((z) => z.id === seleccionada)
  const creando = modo?.tipo === 'zona-nueva'
  const editando = modo?.tipo === 'zona-editar'

  function empezarNueva() {
    setNombre('')
    setColor(COLORES_ZONA[zonas.length % COLORES_ZONA.length])
    setModo({ tipo: 'zona-nueva' })
  }

  function empezarEdicion(zona) {
    setNombre(zona.nombre)
    setColor(zona.color)
    setModo({ tipo: 'zona-editar', id: zona.id, geometria: zona.geometria })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    onError('')
    try {
      const datos = { nombre, color, geometria: modo.geometria }
      if (creando) {
        onGuardada(await api.crearZona(datos), true)
      } else {
        onGuardada(await api.editarZona(modo.id, datos), false)
      }
      setModo(null)
    } catch (e) {
      onError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  // Zona que se está por borrar (abre la ventana de confirmación)
  const [aBorrar, setABorrar] = useState(null)

  async function borrar(zona) {
    setABorrar(null)
    try {
      await api.borrarZona(zona.id)
      onBorrada(zona.id)
    } catch (e) {
      onError(e.message)
    }
  }

  if (creando || editando) {
    const hayContorno = !!modo.geometria
    return (
      <form className="formulario" onSubmit={guardar}>
        <h2>{creando ? 'Nueva zona' : 'Editar zona'}</h2>
        {creando && !hayContorno && (
          <p className="paso">
            <b>1.</b> Dibujá el contorno de la zona en el mapa.
          </p>
        )}
        {creando && hayContorno && (
          <p className="paso paso--listo">
            Contorno dibujado.{' '}
            <button type="button" className="enlace-boton" onClick={() => setModo({ tipo: 'zona-nueva' })}>
              Volver a dibujar
            </button>
          </p>
        )}
        {editando && <p className="paso">Arrastrá los vértices en el mapa para cambiar el contorno.</p>}

        <label htmlFor="zona-nombre">Nombre</label>
        <input
          id="zona-nombre"
          className="entrada"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Zona Norte"
          maxLength={100}
          required
        />

        <span className="etiqueta">Color</span>
        <SelectorColor valor={color} onCambio={setColor} />

        <p className="texto-suave">Los barrios cuyo centro quede dentro del contorno se asignan a la zona.</p>

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={() => setModo(null)}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !hayContorno || !nombre.trim()}>
            {guardando ? 'Guardando…' : 'Guardar zona'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="listado">
      <button type="button" className="boton boton--ancho" onClick={empezarNueva}>
        + Nueva zona
      </button>

      {zonas.length === 0 ? (
        <p className="vacio">Todavía no hay zonas. Creá la primera dibujándola sobre el mapa.</p>
      ) : (
        <ul className="items">
          {zonas.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                className="item"
                aria-pressed={z.id === seleccionada}
                onClick={() => onSeleccionar(z)}
              >
                <span className="item__color" style={{ background: z.color }} />
                <span className="item__texto">
                  <b>{z.nombre}</b>
                  <small>{z.barrios.length === 1 ? '1 barrio' : `${z.barrios.length} barrios`}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {zonaActiva && (
        <section className="detalle">
          <h3>{zonaActiva.nombre}</h3>
          <p className="texto-suave">
            {zonaActiva.barrios.length === 0
              ? 'No tiene barrios adentro.'
              : zonaActiva.barrios
                  .slice(0, 15)
                  .map((b) => b.nombre)
                  .join(', ') + (zonaActiva.barrios.length > 15 ? ` y ${zonaActiva.barrios.length - 15} más.` : '.')}
          </p>
          <div className="acciones acciones-iconos">
            <BotonIcono icono={Pencil} etiqueta="Editar zona" onClick={() => empezarEdicion(zonaActiva)} />
            <BotonIcono icono={Trash2} etiqueta="Borrar zona" variante="peligro" onClick={() => setABorrar(zonaActiva)} />
          </div>
          {aBorrar && (
            <Confirmacion
              titulo="Borrar zona"
              textoConfirmar="Borrar"
              onCerrar={() => setABorrar(null)}
              onConfirmar={() => borrar(aBorrar)}
            >
              ¿Seguro que querés borrar la zona <b>{aBorrar.nombre}</b>? Sus barrios quedan sin zona.
            </Confirmacion>
          )}
        </section>
      )}
    </div>
  )
}

export default PanelZonas
