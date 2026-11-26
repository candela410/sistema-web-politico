import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import Dropdown from 'react-bootstrap/Dropdown'
import { Bell, BellOff, ClipboardCheck, ClipboardList, DatabaseBackup, KeyRound } from 'lucide-react'
import { marcarLeidos, obtenerAvisos } from '../../api/avisos'
import { tiene } from '../../permisos'

// Campanita de la barra superior con las notificaciones del usuario (tabla
// notificaciones, ver core/avisos_views.py). El número rojo son las que no leyó;
// al abrirla quedan leídas en la base, así no vuelven a aparecer en otra computadora.
// Se actualiza sola cada minuto mientras la pestaña está a la vista.

const CADA = 60 * 1000
const ICONOS = {
  cuestionario_asignado: ClipboardList,
  encuesta_cargada: ClipboardCheck,
  backup_fallido: DatabaseBackup,
  contrasena_cambiada: KeyRound,
}

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

function Avisos({ usuario }) {
  const [avisos, setAvisos] = useState(null)
  const [sinLeer, setSinLeer] = useState(0)
  const [error, setError] = useState(false)
  // Mientras está abierto se resaltan los que no estaban leídos al abrirlo
  const [nuevos, setNuevos] = useState(null)

  const cargar = useCallback(() => {
    return obtenerAvisos()
      .then((r) => {
        setAvisos(r.avisos)
        setSinLeer(r.sin_leer)
        setError(false)
        return r.avisos
      })
      .catch(() => {
        setError(true)
        return null
      })
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

  async function alAbrirOCerrar(abierto) {
    if (!abierto) {
      setNuevos(null)
      return
    }
    const lista = (await cargar()) ?? avisos ?? []
    setNuevos(new Set(lista.filter((a) => !a.leida).map((a) => a.id)))
    if (lista.some((a) => !a.leida)) {
      // Al abrir, todo queda leído (en la base)
      setSinLeer(0)
      marcarLeidos().catch(() => cargar())
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
            <span>No tiene avisos por ahora.</span>
          </div>
        ) : (
          <ul className="avisos__lista">
            {avisos.map((a) => {
              const Icono = ICONOS[a.tipo] ?? Bell
              const nuevo = nuevos?.has(a.id) ?? false
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