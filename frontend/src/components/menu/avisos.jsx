import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Dropdown from 'react-bootstrap/Dropdown'
import { Bell, BellOff, CirclePlus, ClipboardCheck, ClipboardList, Pencil, Trash2 } from 'lucide-react'
import { obtenerAvisos } from '../../api/avisos'
import { tiene } from '../../permisos'

// Campanita de la barra superior con los avisos automáticos del sistema
// (los arma el backend en core/avisos_views.py). El número rojo son los avisos
// nuevos desde la última vez que se abrió; eso lo recuerda el navegador.
// Se actualiza sola cada minuto mientras la pestaña está a la vista.

const CADA = 60 * 1000
const ICONOS = { asignacion: ClipboardList, encuesta: ClipboardCheck, crear: CirclePlus, editar: Pencil, borrar: Trash2 }

// Igual que el menú del usuario: 8px debajo del botón, alineado a la derecha
const UBICACION = {
  modifiers: [
    { name: 'offset', options: { offset: [0, 8] } },
    { name: 'computeStyles', options: { gpuAcceleration: false } },
  ],
}

const relativo = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' })
const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

function hace(iso) {
  const segundos = (new Date(iso) - Date.now()) / 1000
  const minutos = Math.round(segundos / 60)
  if (minutos > -1) return 'recién'
  if (minutos > -60) return relativo.format(minutos, 'minute')
  const horas = Math.round(minutos / 60)
  if (horas > -24) return relativo.format(horas, 'hour')
  const dias = Math.round(horas / 24)
  if (dias > -7) return relativo.format(dias, 'day')
  return fechaLarga.format(new Date(iso))
}

// Momento (en milisegundos) de la última vez que se abrió la campanita; 0 = nunca
function leerVisto(clave) {
  try {
    return Number(localStorage.getItem(clave)) || 0
  } catch {
    return 0
  }
}

function guardarVisto(clave, valor) {
  try {
    localStorage.setItem(clave, String(valor))
  } catch {
    // sin localStorage, el número vuelve a aparecer al recargar
  }
}

function Avisos({ usuario }) {
  const clave = `avisos-vistos-${usuario.id}`
  const [avisos, setAvisos] = useState(null)
  const [error, setError] = useState(false)
  const [visto, setVisto] = useState(() => leerVisto(clave))
  // Mientras está abierto se resaltan los que eran nuevos al abrirlo
  const [nuevosDesde, setNuevosDesde] = useState(null)

  const cargar = useCallback(() => {
    obtenerAvisos()
      .then((lista) => {
        setAvisos(lista)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    cargar()
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') cargar()
    }, CADA)
    const alVolver = () => document.visibilityState === 'visible' && cargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargar, usuario.campana?.id])

  const esNuevo = (a, desde) => new Date(a.fecha).getTime() > desde
  const sinLeer = (avisos ?? []).filter((a) => esNuevo(a, visto)).length

  function alAbrirOCerrar(abierto) {
    if (abierto) {
      cargar()
      setNuevosDesde(visto)
      // Al abrir, todo queda leído
      // (si el reloj de la compu atrasa, se toma la fecha del aviso más nuevo)
      const masNuevo = avisos?.length ? new Date(avisos[0].fecha).getTime() : 0
      const marca = Math.max(Date.now(), masNuevo)
      setVisto(marca)
      guardarVisto(clave, marca)
    } else {
      setNuevosDesde(null)
    }
  }

  return (
    <Dropdown className="avisos" align="end" onToggle={alAbrirOCerrar}>
      <Dropdown.Toggle
        as="button"
        type="button"
        bsPrefix="avisos__boton"
        aria-label={sinLeer ? `Avisos: ${sinLeer} sin leer` : 'Avisos'}
        title="Avisos"
      >
        <Bell size={21} aria-hidden="true" />
        {sinLeer > 0 && <span className="avisos__numero">{sinLeer > 9 ? '9+' : sinLeer}</span>}
      </Dropdown.Toggle>
      <Dropdown.Menu className="avisos__desplegable" popperConfig={UBICACION}>
        <div className="avisos__cabecera">
          <strong>Avisos</strong>
          {avisos?.length > 0 && <span>Últimos 30 días</span>}
        </div>

        {error && !avisos ? (
          <p className="avisos__vacio">No se pudieron cargar los avisos.</p>
        ) : avisos === null ? (
          <p className="avisos__vacio">Cargando…</p>
        ) : avisos.length === 0 ? (
          <div className="avisos__vacio">
            <BellOff size={28} strokeWidth={1.5} aria-hidden="true" />
            <span>No tenés avisos por ahora.</span>
          </div>
        ) : (
          <ul className="avisos__lista">
            {avisos.map((a) => {
              const Icono = ICONOS[a.tipo] ?? Bell
              const nuevo = nuevosDesde !== null && esNuevo(a, nuevosDesde)
              return (
                <li key={a.id}>
                  <Dropdown.Item as={Link} to={a.enlace} className={`avisos__item${nuevo ? ' avisos__item--nuevo' : ''}`}>
                    <span className={`avisos__item-icono avisos__item-icono--${a.tipo}`}>
                      <Icono size={17} aria-hidden="true" />
                    </span>
                    <span className="avisos__item-texto">
                      <strong>{a.titulo}</strong>
                      <span>{a.texto}</span>
                      <time dateTime={a.fecha} title={fechaLarga.format(new Date(a.fecha))}>
                        {hace(a.fecha)}
                      </time>
                    </span>
                    {nuevo && <span className="avisos__item-punto" aria-label="Nuevo" />}
                  </Dropdown.Item>
                </li>
              )
            })}
          </ul>
        )}

        {tiene(usuario, 'admin.view_logentry') && (
          <Dropdown.Item as={Link} to="/actividad" className="avisos__pie">
            Ver toda la actividad
          </Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  )
}

export default Avisos