import { useEffect, useState } from 'react'
import { CalendarClock, DatabaseBackup, RotateCcw, Trash2 } from 'lucide-react'
import * as api from '../../api/backup'
import { useConCambios } from '../../validaciones'
import AvisoOk from '../comunes/AvisoOk'
import Confirmacion from '../comunes/Confirmacion'
import Esqueleto from '../comunes/Esqueleto'
import Modal from '../comunes/Modal'

// Configuración → Backup (solo superusuarios).
// - Backup completo (full): una copia de toda la base, guardada en Neon como
//   snapshot. "Hacer backup ahora" saca uno en el momento.
// - Restaurar: la base vuelve a quedar como estaba cuando se hizo ese backup.
//   Todo lo cargado después se pierde, por eso pide escribir RESTAURAR.
// - Backup automático: se elige cada cuánto y a qué hora se hace solo.

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const PALABRA = 'RESTAURAR'
const formato = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeStyle: 'short' })
const fecha = (iso) => (iso ? formato.format(new Date(iso)) : '—')

function Restaurar({ backup, onCerrar }) {
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  async function restaurar(e) {
    e.preventDefault()
    setError('')
    setTrabajando(true)
    try {
      await api.restaurarBackup(backup.id, texto)
      setListo(true)
    } catch (err) {
      setError(err.message)
      setTrabajando(false)
    }
  }

  if (listo)
    return (
      <Modal titulo="Base restaurada" onCerrar={() => window.location.replace('/login')}>
        <p className="modal__texto">
          La base de datos volvió a como estaba el <b>{fecha(backup.creado)}</b>
          <br />
          Para seguir trabajando con esos datos tiene que iniciar sesión de nuevo.
        </p>
        <div className="acciones">
          <button type="button" className="boton" onClick={() => window.location.replace('/login')} autoFocus>
            Ir a iniciar sesión
          </button>
        </div>
      </Modal>
    )

  return (
    <Modal titulo="Restaurar backup" onCerrar={trabajando ? () => {} : onCerrar}>
      <form className="formulario-modal" onSubmit={restaurar}>
        <div className="modal__texto">
          <p>
            Toda la base de datos va a volver a como estaba el <b>{fecha(backup.creado)}</b>:
          </p>
          <ul className="backup__consecuencias">
            <li>
              Se pierde <b>todo lo cargado después</b> de esa fecha: encuestas, usuarios, cuestionarios, cambios de
              contraseña, etc.
            </li>
            <li>Todos los usuarios conectados tendrán que volver a iniciar sesión.</li>
            <li>Neon conserva la base actual como una rama aparte («production (old)»), por si hay que volver atrás.</li>
          </ul>
        </div>
        <label>
          Para confirmar, escriba {PALABRA}
          <input
            className="entrada"
            value={texto}
            onChange={(e) => setTexto(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={trabajando}
          />
        </label>
        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </button>
          <button type="submit" className="boton boton--rojo" disabled={trabajando || texto !== PALABRA}>
            <RotateCcw size={17} aria-hidden="true" />
            {trabajando ? 'Restaurando…' : 'Restaurar la base'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Programacion({ programacion, configurado, onGuardada, onError }) {
  const [form, setForm] = useState({
    activo: programacion.activo,
    frecuencia: programacion.frecuencia,
    dia_semana: programacion.dia_semana,
    hora: programacion.hora,
  })
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      onGuardada(await api.guardarProgramacion(form))
    } catch (err) {
      onError(err.message)
      setGuardando(false)
    }
  }

  return (
    <section className="tarjeta-form backup__tarjeta">
      <h2>
        <CalendarClock size={20} aria-hidden="true" />
        Backup automático
      </h2>
      <p className="texto-suave">
        El sistema hace solo un backup completo en el horario que elija. Si a esa hora el servidor está suspendido por
        falta de uso, el backup se hace apenas alguien vuelve a entrar.
      </p>
      <form className="backup__programacion" onSubmit={guardar}>
        <label className="interruptor">
          <input
            type="checkbox"
            role="switch"
            checked={form.activo}
            onChange={(e) => cambiar('activo', e.target.checked)}
            disabled={!configurado}
          />
          <span className="interruptor__pista" aria-hidden="true" />
          {form.activo ? 'Activado' : 'Desactivado'}
        </label>
        <div className="backup__campos">
          <label>
            Frecuencia
            <select
              className="entrada"
              value={form.frecuencia}
              onChange={(e) => cambiar('frecuencia', e.target.value)}
              disabled={!form.activo}
            >
              <option value="diaria">Todos los días</option>
              <option value="semanal">Una vez por semana</option>
            </select>
          </label>
          {form.frecuencia === 'semanal' && (
            <label>
              Día
              <select
                className="entrada"
                value={form.dia_semana}
                onChange={(e) => cambiar('dia_semana', Number(e.target.value))}
                disabled={!form.activo}
              >
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Hora
            <input
              className="entrada"
              type="time"
              value={form.hora}
              onChange={(e) => cambiar('hora', e.target.value)}
              disabled={!form.activo}
              required
            />
          </label>
        </div>
        <button type="submit" className="boton" disabled={guardando || !conCambios || !form.hora}>
          {guardando ? 'Guardando…' : 'Guardar programación'}
        </button>
      </form>
      <dl className="backup__datos">
        <div>
          <dt>Próximo backup</dt>
          <dd>{programacion.activo ? fecha(programacion.proximo) : 'Sin programar'}</dd>
        </div>
        <div>
          <dt>Último backup automático</dt>
          <dd>{programacion.ultimo_automatico ? fecha(programacion.ultimo_automatico) : 'Todavía no se hizo ninguno'}</dd>
        </div>
      </dl>
      {programacion.ultimo_error && (
        <p className="aviso-error" role="alert">
          El último backup automático falló: {programacion.ultimo_error}
        </p>
      )}
    </section>
  )
}

function Backup() {
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [confirmando, setConfirmando] = useState(null) // 'crear' | { borrar: backup }
  const [restaurando, setRestaurando] = useState(null)

  const recibir = (nuevo) => {
    setEstado(nuevo)
    setError('')
    setAviso(nuevo.aviso ?? '')
  }

  useEffect(() => {
    api
      .obtenerBackups()
      .then(setEstado)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 6000)
    return () => clearTimeout(t)
  }, [aviso])

  async function ejecutar(accion) {
    setError('')
    try {
      recibir(await accion())
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmando(null)
    }
  }

  if (!estado)
    return error ? (
      <p className="aviso-error" role="alert">
        {error}
      </p>
    ) : (
      <Esqueleto />
    )

  const { backups, maximo, configurado } = estado
  const reemplaza = backups.length >= maximo

  return (
    <>
      <AvisoOk>{aviso}</AvisoOk>
      {error && (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      )}
      {!configurado && (
        <p className="aviso-info">
          Falta conectar el sistema con Neon. En el servidor (Render → Environment) cargue las variables{' '}
          <b>{estado.faltan.join(' y ')}</b> y vuelva a desplegar. La clave se crea en Neon → Account settings → API
          keys, y el id del proyecto está en Neon → Project settings.
        </p>
      )}
      {estado.error_neon && (
        <p className="aviso-error" role="alert">
          {estado.error_neon}
        </p>
      )}

      <section className="tarjeta-form backup__tarjeta">
        <div className="backup__cabecera">
          <div>
            <h2>
              <DatabaseBackup size={20} aria-hidden="true" />
              Backup completo
            </h2>
            <p className="texto-suave">
              Copia de toda la base de datos (estructura y datos) guardada en Neon.{' '}
              {maximo === 1
                ? 'Se conserva un solo backup: cada uno nuevo reemplaza al anterior.'
                : `Se conservan los últimos ${maximo} backups.`}
            </p>
          </div>
          <button type="button" className="boton" onClick={() => setConfirmando('crear')} disabled={!configurado}>
            <DatabaseBackup size={18} aria-hidden="true" />
            Hacer backup ahora
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="vacio-tarjeta">{configurado ? 'Todavía no hay ningún backup guardado.' : 'Sin backups.'}</p>
        ) : (
          <ul className="tarjetas-lista">
            {backups.map((b) => (
              <li key={b.id} className="tarjeta-fila">
                <div className="tarjeta-fila__texto">
                  <h3>
                    {fecha(b.creado)}
                    <span className={`etiqueta ${b.automatico ? 'etiqueta--violeta' : 'etiqueta--verde'}`}>
                      {b.automatico ? 'Automático' : 'Manual'}
                    </span>
                  </h3>
                  <p>{b.nombre}</p>
                </div>
                <div className="tarjeta-fila__acciones">
                  <button type="button" className="boton boton--borde boton--chico" onClick={() => setRestaurando(b)}>
                    <RotateCcw size={16} aria-hidden="true" />
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="boton boton--borde boton--chico"
                    onClick={() => setConfirmando({ borrar: b })}
                    aria-label={`Borrar el backup del ${fecha(b.creado)}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Programacion
        key={JSON.stringify(estado.programacion)}
        programacion={estado.programacion}
        configurado={configurado}
        onGuardada={recibir}
        onError={setError}
      />

      {confirmando === 'crear' && (
        <Confirmacion
          titulo="Hacer backup ahora"
          textoConfirmar="Hacer backup"
          peligro={false}
          onCerrar={() => setConfirmando(null)}
          onConfirmar={() => ejecutar(api.hacerBackup)}
        >
          Se va a guardar una copia completa de la base tal como está en este momento.
          {reemplaza && (
            <>
              {' '}
              El backup del <b>{fecha(backups[backups.length - 1].creado)}</b> se va a <b>reemplazar</b> por el nuevo.
            </>
          )}
        </Confirmacion>
      )}
      {confirmando?.borrar && (
        <Confirmacion
          titulo="Borrar backup"
          textoConfirmar="Borrar"
          onCerrar={() => setConfirmando(null)}
          onConfirmar={() => ejecutar(() => api.borrarBackup(confirmando.borrar.id))}
        >
          ¿Desea borrar el backup del <b>{fecha(confirmando.borrar.creado)}</b>? No se puede deshacer
          {backups.length === 1 && ' y el sistema quedará sin ningún backup'}.
        </Confirmacion>
      )}
      {restaurando && <Restaurar backup={restaurando} onCerrar={() => setRestaurando(null)} />}
    </>
  )
}

export default Backup
