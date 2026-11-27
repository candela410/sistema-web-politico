import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Eye, KeyRound, Pencil } from 'lucide-react-native'
import * as api from '../../api/usuarios'
import { MARCA, useTema } from '../../tema/tema'
import {
  Text,
  Avatar,
  Acciones,
  AvisoOk,
  Boton,
  BotonIcono,
  Buscador,
  Encabezado,
  Entrada,
  Esqueleto,
  Etiqueta,
  Fila,
  Interruptor,
  InterruptorCampo,
  Modal,
  Pagina,
  Paginacion,
  Tarjeta,
  Texto,
  TextoError,
  VacioTarjeta,
  usePaginado,
} from '../../ui'
import { normalizar } from '../../util/normalizar'
import { tiene } from '../../util/permisos'
import { emailValido, MENSAJE_EMAIL, useConCambios } from '../../util/validaciones'
import FichaUsuario from '../perfil/FichaUsuario'

const formatoFecha = (iso) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Opción de radio (rol del usuario)
function Radio({ marcada, onPress, children }) {
  const { c } = useTema()
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: marcada }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: marcada ? MARCA.violeta : c.borde, alignItems: 'center', justifyContent: 'center' }}>
        {marcada && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: MARCA.violeta }} />}
      </View>
      <Texto>{children}</Texto>
    </Pressable>
  )
}

// Alta y edición. No se escribe contraseña: al crear el usuario le llega por
// correo una invitación para elegirla, y después se restablece con la llave.
function FormularioUsuario({ usuario, grupos, onGuardado, onCerrar }) {
  const { c } = useTema()
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    grupo: usuario?.grupos[0]?.id ?? null,
    activo: usuario?.activo ?? true,
    documento: usuario?.documento ?? '',
    telefono: usuario?.telefono ?? '',
    direccion: usuario?.direccion ?? '',
  })
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const errorDeEmail = form.email.trim() && !emailValido(form.email) ? MENSAJE_EMAIL : ''
  const completo = form.nombre.trim() && form.email.trim() && (form.grupo !== null || usuario?.es_superusuario)

  async function guardar() {
    setError('')
    setTocado(true)
    if (errorDeEmail) return
    setGuardando(true)
    const datos = {
      nombre: form.nombre,
      apellido: form.apellido,
      email: form.email.trim(),
      grupos: form.grupo === null ? [] : [form.grupo],
      activo: form.activo,
      documento: form.documento,
      telefono: form.telefono,
      direccion: form.direccion,
    }
    try {
      if (usuario) onGuardado(await api.editarUsuario(usuario.id, datos), null)
      else {
        const r = await api.crearUsuario(datos)
        onGuardado(r.usuario, r)
      }
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={usuario ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar} ancho>
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <Entrada style={{ flex: 1 }} etiqueta="Nombre" value={form.nombre} onChangeText={cambiar('nombre')} autoCapitalize="words" maxLength={150} autoFocus />
        <Entrada style={{ flex: 1 }} etiqueta="Apellido" value={form.apellido} onChangeText={cambiar('apellido')} autoCapitalize="words" maxLength={150} />
      </Fila>
      <Entrada
        etiqueta="Correo electrónico"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={254}
        placeholder="usuario@correo.com"
        value={form.email}
        onChangeText={cambiar('email')}
        onBlur={() => setTocado(true)}
        error={tocado ? errorDeEmail : ''}
      />
      <Texto estilo="etiqueta">Rol</Texto>
      <View style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 10, paddingHorizontal: 10, marginBottom: 12 }}>
        {grupos.map((g) => (
          <Radio key={g.id} marcada={form.grupo === g.id} onPress={() => setForm((f) => ({ ...f, grupo: g.id }))}>
            {g.nombre}
          </Radio>
        ))}
      </View>
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <Entrada
          style={{ flex: 1 }}
          etiqueta="Documento"
          keyboardType="number-pad"
          maxLength={10}
          placeholder="Sin puntos"
          value={form.documento}
          onChangeText={cambiar('documento')}
          // El documento identifica al usuario (clave primaria): se carga al crearlo y no se cambia
          editable={!usuario}
          ayuda={usuario ? 'No se puede modificar.' : undefined}
        />
        <Entrada style={{ flex: 1 }} etiqueta="Teléfono" keyboardType="phone-pad" maxLength={20} value={form.telefono} onChangeText={cambiar('telefono')} />
      </Fila>
      <Entrada etiqueta="Dirección (opcional)" autoCapitalize="sentences" maxLength={200} value={form.direccion} onChangeText={cambiar('direccion')} />
      <InterruptorCampo valor={form.activo} onCambio={cambiar('activo')}>
        Activo
      </InterruptorCampo>
      {!usuario && (
        <Texto estilo="chico" style={{ backgroundColor: c.superficie2, padding: 10, borderRadius: 10 }}>
          Al crearlo, el usuario recibirá un correo con su nombre de usuario (apellido + inicial del nombre) y un enlace para elegir su contraseña.
        </Texto>
      )}
      <TextoError>{error}</TextoError>
      <Acciones onCancelar={onCerrar}>
        <Boton
          titulo={guardando ? 'Guardando…' : usuario ? 'Guardar cambios' : 'Crear usuario'}
          onPress={guardar}
          cargando={guardando}
          disabled={!completo || !conCambios}
        />
      </Acciones>
    </Modal>
  )
}

export default function Usuarios({ usuario: yo }) {
  const { c } = useTema()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const [aviso, setAviso] = useState('')
  const [enviandoA, setEnviandoA] = useState(null)

  const cargar = () =>
    api
      .obtenerUsuarios()
      .then(setDatos)
      .catch((e) => setError(e.message))
  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 6000)
    return () => clearTimeout(t)
  }, [aviso])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    const lista = datos?.usuarios ?? []
    if (!texto) return lista
    return lista.filter((u) => normalizar(`${u.nombre} ${u.apellido} ${u.username} ${u.email}`).includes(texto))
  }, [datos, busqueda])
  const paginado = usePaginado(visibles)

  const reemplazar = (u, nuevo) =>
    setDatos((d) => ({ ...d, usuarios: nuevo ? [u, ...d.usuarios] : d.usuarios.map((x) => (x.id === u.id ? u : x)) }))

  async function cambiarEstado(u) {
    try {
      const actualizado = u.activo ? await api.desactivarUsuario(u.id) : await api.editarUsuario(u.id, { activo: true })
      reemplazar(actualizado)
      setAviso(actualizado.activo ? 'El usuario fue activado.' : 'El usuario fue desactivado.')
    } catch (e) {
      setError(e.message)
    }
  }

  async function enviarRestablecer(u) {
    setError('')
    setEnviandoA(u.id)
    try {
      const { email, redirigido } = await api.enviarRestablecer(u.id)
      setAviso(
        redirigido
          ? `${u.email} es un correo de prueba: el enlace se envió a ${email}.`
          : `Se envió a ${email} un enlace para restablecer la contraseña.`,
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviandoA(null)
    }
  }

  const puedeEditar = tiene(yo, 'core.change_usuario')

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado
        titulo="Usuarios"
        descripcion={`Personas que trabajan en ${yo.campana?.nombre ?? 'la campaña'}.`}
        accion={tiene(yo, 'core.add_usuario') && datos ? '+ Nuevo usuario' : null}
        onAccion={() => setEditando('nuevo')}
      />
      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, usuario o correo" etiqueta="Buscar usuarios" />
      <AvisoOk>{aviso}</AvisoOk>
      <TextoError>{error}</TextoError>

      {!datos ? (
        !error && <Esqueleto />
      ) : visibles.length === 0 ? (
        <VacioTarjeta titulo={datos.usuarios.length ? 'No hay usuarios que coincidan.' : 'Todavía no hay usuarios en esta campaña.'} />
      ) : (
        <>
          {paginado.items.map((u) => (
            <Tarjeta key={u.id} apagada={!u.activo} style={{ gap: 10 }}>
              <Fila gap={12} style={{ alignItems: 'flex-start' }}>
                <Avatar usuario={u} tamano={46} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Fila envolver gap={6}>
                    <Texto estilo="negrita" style={{ fontSize: 16 }}>
                      {`${u.nombre} ${u.apellido}`.trim() || u.email}
                    </Texto>
                    {u.id === yo.id && <Etiqueta color="verde">Usted</Etiqueta>}
                    {!u.activo && <Etiqueta>Desactivado</Etiqueta>}
                  </Fila>
                  <Texto estilo="suave">
                    <Text style={{ fontWeight: '700', color: c.texto }}>{u.username}</Text> · {u.email}
                  </Texto>
                  <Fila envolver gap={6}>
                    {u.grupos.map((g) => (
                      <Etiqueta key={g.id} color="magenta">
                        {g.nombre}
                      </Etiqueta>
                    ))}
                  </Fila>
                  <Texto estilo="chico">{u.ultimo_ingreso ? `Último ingreso: ${formatoFecha(u.ultimo_ingreso)}` : 'Nunca ingresó'}</Texto>
                </View>
              </Fila>
              <Fila style={{ justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.linea, paddingTop: 10 }}>
                {puedeEditar && u.id !== yo.id ? (
                  <Interruptor
                    activo={u.activo}
                    onCambiar={() => cambiarEstado(u)}
                    etiqueta={`Usuario ${u.email} activo`}
                    confirmacion={{
                      titulo: 'Desactivar usuario',
                      mensaje: `¿Desea desactivar a ${`${u.nombre} ${u.apellido}`.trim() || u.email}? No podrá iniciar sesión hasta que se vuelva a activar.`,
                    }}
                  />
                ) : (
                  <View />
                )}
                <Fila>
                  <BotonIcono icono={Eye} etiqueta="Ver datos" onPress={() => setViendo(u)} />
                  {puedeEditar && (
                    <>
                      <BotonIcono
                        icono={KeyRound}
                        etiqueta="Restablecer contraseña"
                        ayuda={
                          u.activo
                            ? enviandoA === u.id
                              ? 'Enviando…'
                              : `Enviar a ${u.email} un enlace para restablecer la contraseña`
                            : 'Active el usuario para restablecer su contraseña'
                        }
                        disabled={!u.activo || enviandoA === u.id}
                        onPress={() => enviarRestablecer(u)}
                      />
                      <BotonIcono icono={Pencil} etiqueta="Editar" onPress={() => setEditando(u)} />
                    </>
                  )}
                </Fila>
              </Fila>
            </Tarjeta>
          ))}
          <Paginacion {...paginado} />
        </>
      )}

      {viendo && (
        <Modal titulo="Datos del usuario" onCerrar={() => setViendo(null)}>
          <FichaUsuario usuario={viendo} />
          <Acciones>
            <Boton titulo="Cerrar" onPress={() => setViendo(null)} />
          </Acciones>
        </Modal>
      )}

      {editando && (
        <FormularioUsuario
          usuario={editando === 'nuevo' ? null : editando}
          grupos={datos.grupos}
          onCerrar={() => setEditando(null)}
          onGuardado={(u, alta) => {
            reemplazar(u, Boolean(alta))
            setEditando(null)
            if (!alta) setAviso('Los cambios se guardaron correctamente.')
            else if (alta.invitacion)
              setAviso(
                alta.invitacion === u.email
                  ? `Usuario «${u.username}» creado. Se envió a ${u.email} la invitación para elegir su contraseña.`
                  : `Usuario «${u.username}» creado. ${u.email} es un correo de prueba: la invitación se envió a ${alta.invitacion}.`,
              )
            else if (alta.aviso_invitacion) setError(`Usuario creado, pero no se pudo enviar la invitación: ${alta.aviso_invitacion}`)
            else setAviso(`Usuario «${u.username}» creado.`)
          }}
        />
      )}
    </Pagina>
  )
}
