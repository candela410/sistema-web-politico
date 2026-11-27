import { useEffect, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { CalendarClock, Clock, DatabaseBackup, RotateCcw, Trash2 } from 'lucide-react-native'
import * as api from '../../api/backup'
import { useSesion } from '../../sesion/Sesion'
import { useTema } from '../../tema/tema'
import { Acciones, AvisoOk, Boton, Confirmacion, Entrada, Esqueleto, Etiqueta, Fila, InterruptorCampo, Modal, Selector, Tarjeta, Texto, VacioTarjeta, Text } from '../../ui'
import { useConCambios } from '../../util/validaciones'

// Configuración → Backup (solo superusuarios). Backup completo (snapshot de
// Neon), restaurar (pide escribir RESTAURAR) y backup automático programado.
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const PALABRA = 'RESTAURAR'
const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function Aviso({ tipo = 'error', children }) {
  const { c } = useTema()
  const error = tipo === 'error'
  return (
    <Text
      accessibilityRole={error ? 'alert' : undefined}
      style={{
        color: error ? c.rojoTexto : c.texto,
        backgroundColor: error ? c.fondoError : c.superficie2,
        borderColor: error ? c.bordeError : c.linea,
        borderWidth: 1,
        padding: 12,
        borderRadius: 10,
      }}
    >
      {children}
    </Text>
  )
}

function Restaurar({ backup, onCerrar }) {
  const { salir } = useSesion()
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  async function restaurar() {
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
      <Modal titulo="Base restaurada" onCerrar={salir}>
        <Texto style={{ lineHeight: 22 }}>
          La base de datos volvió a como estaba el {fecha(backup.creado)}.{'\n'}Para seguir trabajando con esos datos tiene que iniciar sesión de nuevo.
        </Texto>
        <Acciones>
          <Boton titulo="Ir a iniciar sesión" onPress={salir} />
        </Acciones>
      </Modal>
    )

  return (
    <Modal titulo="Restaurar backup" onCerrar={trabajando ? () => {} : onCerrar}>
      <Texto style={{ marginBottom: 6 }}>Toda la base de datos va a volver a como estaba el {fecha(backup.creado)}:</Texto>
      {[
        'Se pierde todo lo cargado después de esa fecha: encuestas, usuarios, cuestionarios, cambios de contraseña, etc.',
        'Todos los usuarios conectados tendrán que volver a iniciar sesión.',
        'Neon conserva la base actual como una rama aparte («production (old)»), por si hay que volver atrás.',
      ].map((t) => (
        <Texto key={t} estilo="suave" style={{ marginLeft: 8, marginBottom: 4 }}>
          • {t}
        </Texto>
      ))}
      <Entrada
        etiqueta={`Para confirmar, escriba ${PALABRA}`}
        value={texto}
        onChangeText={(t) => setTexto(t.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!trabajando}
        style={{ marginTop: 10 }}
        error={error}
      />
      <Acciones onCancelar={trabajando ? null : onCerrar}>
        <Boton titulo={trabajando ? 'Restaurando…' : 'Restaurar la base'} icono={RotateCcw} variante="rojo" onPress={restaurar} cargando={trabajando} disabled={texto !== PALABRA} />
      </Acciones>
    </Modal>
  )
}

function SelectorHora({ valor, onCambio, disabled }) {
  const { c } = useTema()
  const [abierto, setAbierto] = useState(false)
  const [h, m] = String(valor || '00:00').split(':').map(Number)
  const base = new Date()
  base.setHours(h || 0, m || 0, 0, 0)
  return (
    <View style={{ marginBottom: 12, flex: 1 }}>
      <Texto estilo="etiqueta">Hora</Texto>
      <Pressable
        onPress={() => setAbierto(true)}
        disabled={disabled}
        style={{ height: 46, borderWidth: 1.5, borderRadius: 10, borderColor: c.borde, backgroundColor: c.superficie, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: disabled ? 0.55 : 1 }}
      >
        <Clock size={17} color={c.gris} />
        <Text style={{ color: c.texto, fontSize: 15 }}>{valor || '--:--'}</Text>
      </Pressable>
      {abierto && (
        <DateTimePicker
          value={base}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, d) => {
            if (Platform.OS !== 'ios' || e.type !== 'set') setAbierto(false)
            if (e.type === 'set' && d) onCambio(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
            if (Platform.OS === 'ios' && e.type === 'set') setAbierto(false)
          }}
        />
      )}
    </View>
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

  async function guardar() {
    setGuardando(true)
    try {
      onGuardada(await api.guardarProgramacion(form))
    } catch (err) {
      onError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Tarjeta style={{ gap: 8 }}>
      <Fila>
        <CalendarClock size={20} color={useTema().c.violetaTexto} />
        <Texto estilo="subtitulo">Backup automático</Texto>
      </Fila>
      <Texto estilo="suave">
        El sistema hace solo un backup completo en el horario que elija. Si a esa hora el servidor está suspendido por falta de uso, el backup se hace apenas
        alguien vuelve a entrar.
      </Texto>
      <InterruptorCampo valor={form.activo} onCambio={(v) => cambiar('activo', v)} disabled={!configurado}>
        {form.activo ? 'Activado' : 'Desactivado'}
      </InterruptorCampo>
      <Selector
        etiqueta="Frecuencia"
        valor={form.frecuencia}
        onCambio={(v) => cambiar('frecuencia', v)}
        disabled={!form.activo}
        opciones={[
          { valor: 'diaria', texto: 'Todos los días' },
          { valor: 'semanal', texto: 'Una vez por semana' },
        ]}
      />
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        {form.frecuencia === 'semanal' && (
          <Selector style={{ flex: 1 }} etiqueta="Día" valor={form.dia_semana} onCambio={(v) => cambiar('dia_semana', Number(v))} disabled={!form.activo} opciones={DIAS.map((d, i) => ({ valor: i, texto: d }))} />
        )}
        <SelectorHora valor={form.hora} onCambio={(v) => cambiar('hora', v)} disabled={!form.activo} />
      </Fila>
      <Boton titulo={guardando ? 'Guardando…' : 'Guardar programación'} onPress={guardar} cargando={guardando} disabled={!conCambios || !form.hora} />
      <View style={{ gap: 4, marginTop: 6 }}>
        <Texto estilo="chico">Próximo backup</Texto>
        <Texto>{programacion.activo ? fecha(programacion.proximo) : 'Sin programar'}</Texto>
        <Texto estilo="chico" style={{ marginTop: 4 }}>
          Último backup automático
        </Texto>
        <Texto>{programacion.ultimo_automatico ? fecha(programacion.ultimo_automatico) : 'Todavía no se hizo ninguno'}</Texto>
      </View>
      {programacion.ultimo_error ? <Aviso>El último backup automático falló: {programacion.ultimo_error}</Aviso> : null}
    </Tarjeta>
  )
}

export default function Backup() {
  const { c } = useTema()
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

  if (!estado) return error ? <Aviso>{error}</Aviso> : <Esqueleto />

  const { backups, maximo, configurado } = estado
  const reemplaza = backups.length >= maximo

  return (
    <>
      <AvisoOk>{aviso}</AvisoOk>
      {error ? <Aviso>{error}</Aviso> : null}
      {!configurado && (
        <Aviso tipo="info">
          Falta conectar el sistema con Neon. En el servidor (Render → Environment) cargue las variables {estado.faltan.join(' y ')} y vuelva a desplegar. La
          clave se crea en Neon → Account settings → API keys, y el id del proyecto está en Neon → Project settings.
        </Aviso>
      )}
      {estado.error_neon ? <Aviso>{estado.error_neon}</Aviso> : null}

      <Tarjeta style={{ gap: 10 }}>
        <Fila>
          <DatabaseBackup size={20} color={c.violetaTexto} />
          <Texto estilo="subtitulo">Backup completo</Texto>
        </Fila>
        <Texto estilo="suave">
          Copia de toda la base de datos (estructura y datos) guardada en Neon.{' '}
          {maximo === 1 ? 'Se conserva un solo backup: cada uno nuevo reemplaza al anterior.' : `Se conservan los últimos ${maximo} backups.`}
        </Texto>
        <Boton titulo="Hacer backup ahora" icono={DatabaseBackup} onPress={() => setConfirmando('crear')} disabled={!configurado} />
        {backups.length === 0 ? (
          <VacioTarjeta>{configurado ? 'Todavía no hay ningún backup guardado.' : 'Sin backups.'}</VacioTarjeta>
        ) : (
          backups.map((b) => (
            <View key={b.id} style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 12, padding: 12, gap: 6 }}>
              <Texto estilo="negrita">{fecha(b.creado)}</Texto>
              <Fila>
                <Etiqueta color={b.automatico ? 'violeta' : 'verde'}>{b.automatico ? 'Automático' : 'Manual'}</Etiqueta>
                <Texto estilo="chico" style={{ flex: 1 }} numberOfLines={1}>
                  {b.nombre}
                </Texto>
              </Fila>
              <Fila>
                <Boton titulo="Restaurar" icono={RotateCcw} variante="borde" chico onPress={() => setRestaurando(b)} />
                <Boton titulo="Borrar" icono={Trash2} variante="borde" chico onPress={() => setConfirmando({ borrar: b })} />
              </Fila>
            </View>
          ))
        )}
      </Tarjeta>

      <Programacion
        key={JSON.stringify(estado.programacion)}
        programacion={estado.programacion}
        configurado={configurado}
        onGuardada={recibir}
        onError={setError}
      />

      {confirmando === 'crear' && (
        <Confirmacion titulo="Hacer backup ahora" textoConfirmar="Hacer backup" peligro={false} onCerrar={() => setConfirmando(null)} onConfirmar={() => ejecutar(api.hacerBackup)}>
          {`Se va a guardar una copia completa de la base tal como está en este momento.${
            reemplaza ? ` El backup del ${fecha(backups[backups.length - 1].creado)} se va a reemplazar por el nuevo.` : ''
          }`}
        </Confirmacion>
      )}
      {confirmando?.borrar && (
        <Confirmacion
          titulo="Borrar backup"
          textoConfirmar="Borrar"
          onCerrar={() => setConfirmando(null)}
          onConfirmar={() => ejecutar(() => api.borrarBackup(confirmando.borrar.id))}
        >
          {`¿Desea borrar el backup del ${fecha(confirmando.borrar.creado)}? No se puede deshacer${backups.length === 1 ? ' y el sistema quedará sin ningún backup' : ''}.`}
        </Confirmacion>
      )}
      {restaurando && <Restaurar backup={restaurando} onCerrar={() => setRestaurando(null)} />}
    </>
  )
}
