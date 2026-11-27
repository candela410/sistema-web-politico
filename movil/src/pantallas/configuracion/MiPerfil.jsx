import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Camera, Image as IconoImagen, KeyRound, Pencil, Trash2 } from 'lucide-react-native'
import { guardarFoto, guardarPerfil, pedirCambioDeContrasena, quitarFoto, usuarioActual } from '../../api/auth'
import { MARCA, useTema } from '../../tema/tema'
import { Acciones, Avatar, AvisoOk, Boton, Entrada, Fila, Modal, Tarjeta, Text, Texto, TextoError } from '../../ui'
import { nombreDe, rolDe } from '../../util/usuario'
import { errorEmail, errorPersona, useConCambios } from '../../util/validaciones'
import FichaUsuario from '../perfil/FichaUsuario'
import { elegirFotoCuadrada } from './foto'

// Mi perfil: muestra la foto y los datos (sin editar). Desde "Editar mis
// datos" se cambian la foto, los datos (nombre, apellido, correo, teléfono y
// dirección) y se pide el enlace para cambiar la contraseña.
function errorTelefono(valor) {
  const texto = valor.trim()
  if (!texto) return ''
  const cifras = texto.replace(/\D/g, '').length
  return /^\+?[\d\s()-]+$/.test(texto) && cifras >= 8 && cifras <= 15 ? '' : 'El teléfono debe tener entre 8 y 15 números.'
}

// "Editar mis datos": arriba la foto (cambiar / quitar) y el cambio de
// contraseña; abajo los datos. La foto y la contraseña solo se cambian desde
// acá, no desde la vista de Mi perfil.
function EditarDatos({ usuario, onGuardado, onCerrar, onFoto, onQuitarFoto, onContrasena }) {
  const { c } = useTema()
  // Acción abierta en la sección de arriba: 'foto' | 'quitar' | 'contrasena'
  const [accion, setAccion] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  async function hacer(tarea) {
    setErrorAccion('')
    setMensaje('')
    setOcupado(true)
    try {
      const texto = await tarea()
      if (texto) setMensaje(texto)
      setAccion(null)
    } catch (e) {
      setErrorAccion(e.message)
    } finally {
      setOcupado(false)
    }
  }
  const abrir = (cual) => {
    setMensaje('')
    setErrorAccion('')
    setAccion((a) => (a === cual ? null : cual))
  }
  const [form, setForm] = useState({
    nombre: usuario.nombre ?? '',
    apellido: usuario.apellido ?? '',
    email: usuario.email ?? '',
    telefono: usuario.telefono ?? '',
    direccion: usuario.direccion ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Para cambiar el correo se pide la contraseña de la cuenta (lo exige el backend)
  const [password, setPassword] = useState('')
  const conCambios = useConCambios(form)
  const cambiaCorreo = form.email.trim().toLowerCase() !== (usuario.email ?? '').toLowerCase()
  const cambiar = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }))
  const errores = {
    nombre: form.nombre.trim() ? errorPersona(form.nombre) : 'Ingrese el nombre.',
    apellido: errorPersona(form.apellido, 'El apellido'),
    email: errorEmail(form.email),
    telefono: errorTelefono(form.telefono),
  }
  const valido = !Object.values(errores).some(Boolean) && (!cambiaCorreo || Boolean(password))

  async function guardar() {
    if (!valido) return
    setError('')
    setGuardando(true)
    try {
      const r = await guardarPerfil(cambiaCorreo ? { ...form, password } : form)
      onGuardado(r.usuario, r.correo_pendiente)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Editar mis datos" onCerrar={onCerrar}>
      {/* Foto de perfil y contraseña */}
      <View style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Avatar usuario={usuario} tamano={80} />
        <Fila gap={8} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <Boton
            chico
            titulo={ocupado && accion === 'foto' ? 'Subiendo…' : usuario.foto ? 'Cambiar foto' : 'Subir foto'}
            icono={Camera}
            variante="borde"
            onPress={() => abrir('foto')}
            cargando={ocupado && accion === 'foto'}
          />
          {usuario.foto ? <Boton chico titulo="Quitar foto" icono={Trash2} variante="peligro" onPress={() => abrir('quitar')} /> : null}
          <Boton chico titulo="Cambiar contraseña" icono={KeyRound} variante="borde" onPress={() => abrir('contrasena')} />
        </Fila>
      </View>
      {accion === 'foto' && (
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Boton titulo="Elegir de la galería" icono={IconoImagen} onPress={() => hacer(() => onFoto(false))} disabled={ocupado} />
          <Boton titulo="Sacar una foto" icono={Camera} variante="borde" onPress={() => hacer(() => onFoto(true))} disabled={ocupado} />
        </View>
      )}
      {accion === 'quitar' && (
        <View style={{ gap: 8, marginBottom: 12, backgroundColor: c.superficie2, padding: 12, borderRadius: 10 }}>
          <Texto>¿Desea quitar su foto de perfil? Se mostrará la inicial de su nombre.</Texto>
          <Fila gap={8} style={{ justifyContent: 'flex-end' }}>
            <Boton chico titulo="Cancelar" variante="borde" onPress={() => setAccion(null)} />
            <Boton chico titulo="Quitar" variante="rojo" onPress={() => hacer(onQuitarFoto)} cargando={ocupado} />
          </Fila>
        </View>
      )}
      {accion === 'contrasena' && (
        <View style={{ gap: 8, marginBottom: 12, backgroundColor: c.superficie2, padding: 12, borderRadius: 10 }}>
          <Texto>
            {`Se enviará a ${usuario.email} un enlace para elegir una contraseña nueva. Su contraseña actual sigue funcionando hasta que elija la nueva.`}
          </Texto>
          <Fila gap={8} style={{ justifyContent: 'flex-end' }}>
            <Boton chico titulo="Cancelar" variante="borde" onPress={() => setAccion(null)} />
            <Boton chico titulo="Enviar enlace" onPress={() => hacer(onContrasena)} cargando={ocupado} />
          </Fila>
        </View>
      )}
      <AvisoOk>{mensaje}</AvisoOk>
      <TextoError>{errorAccion}</TextoError>

      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <Entrada style={{ flex: 1 }} etiqueta="Nombre" value={form.nombre} onChangeText={cambiar('nombre')} maxLength={150} autoCapitalize="words" error={errores.nombre} />
        <Entrada style={{ flex: 1 }} etiqueta="Apellido (opcional)" value={form.apellido} onChangeText={cambiar('apellido')} maxLength={150} autoCapitalize="words" error={errores.apellido} />
      </Fila>
      <Entrada etiqueta="Correo electrónico" value={form.email} onChangeText={cambiar('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} error={errores.email} />
      {cambiaCorreo && (
        <Entrada
          etiqueta="Contraseña actual *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          ayuda="Para cambiar el correo confirme su contraseña. Le enviaremos un enlace al correo nuevo para verificarlo."
        />
      )}
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <Entrada style={{ flex: 1 }} etiqueta="Teléfono (opcional)" value={form.telefono} onChangeText={cambiar('telefono')} keyboardType="phone-pad" maxLength={20} error={errores.telefono} />
        <Entrada style={{ flex: 1 }} etiqueta="Documento" value={usuario.documento || 'Sin cargar'} editable={false} />
      </Fila>
      <Entrada etiqueta="Dirección (opcional)" value={form.direccion} onChangeText={cambiar('direccion')} maxLength={200} autoCapitalize="sentences" />
      <Texto estilo="chico" style={{ backgroundColor: c.superficie2, padding: 10, borderRadius: 10 }}>
        
      </Texto>
      <TextoError>{error}</TextoError>
      <Acciones onCancelar={onCerrar}>
        <Boton titulo={guardando ? 'Guardando…' : 'Guardar cambios'} onPress={guardar} cargando={guardando} disabled={!valido || !conCambios} />
      </Acciones>
    </Modal>
  )
}

export default function MiPerfil({ usuario, onCambio }) {
  const { c } = useTema()
  const [editando, setEditando] = useState(false)
  const [aviso, setAviso] = useState('')

  // Datos frescos (por si cambiaron desde que se inició sesión)
  useEffect(() => {
    usuarioActual()
      .then((u) => u && onCambio(u))
      .catch(() => {})
  }, [onCambio])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 8000)
    return () => clearTimeout(t)
  }, [aviso])

  // Acciones del modal "Editar mis datos": devuelven el mensaje para mostrar
  // (o lanzan el error, que el modal muestra)
  async function cambiarContrasena() {
    const r = await pedirCambioDeContrasena()
    return `Se envió a ${r.email} un enlace para elegir una contraseña nueva. Revise su correo.`
  }

  async function elegirFoto(conCamara) {
    const foto = await elegirFotoCuadrada(conCamara)
    if (!foto) return ''
    onCambio(await guardarFoto(foto))
    return 'Se actualizó su foto de perfil.'
  }

  async function borrarFoto() {
    onCambio(await quitarFoto())
    return 'Se quitó su foto de perfil.'
  }

  function guardado(nuevo, correoPendiente) {
    const cambioUsuario = nuevo.username !== usuario.username
    onCambio(nuevo)
    setEditando(false)
    setAviso(
      correoPendiente
        ? `Sus datos se guardaron. Para terminar de cambiar el correo, abra el enlace que le enviamos a ${correoPendiente}.`
        : cambioUsuario ? `Sus datos se guardaron. Su nombre de usuario ahora es «${nuevo.username}»: úselo para ingresar.` : 'Sus datos se guardaron correctamente.',
    )
  }

  return (
    <>
      {/* Cabecera violeta del desarrollo móvil: foto, nombre y rol */}
      <View style={{ alignItems: 'center', backgroundColor: MARCA.violeta, borderRadius: 26, paddingTop: 22, paddingBottom: 22, paddingHorizontal: 16 }}>
        {/* Solo se ve: la foto se cambia desde "Editar mis datos" */}
        <Avatar usuario={usuario} tamano={88} />
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 12 }} titulo>
          {nombreDe(usuario)}
        </Text>
        <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: MARCA.naranja }}>
          <Text style={{ color: '#111', fontSize: 13, fontWeight: '700' }}>{rolDe(usuario)}</Text>
        </View>
      </View>

      <Boton titulo="Editar mis datos" icono={Pencil} onPress={() => setEditando(true)} grande />
      <AvisoOk>{aviso}</AvisoOk>
      <Tarjeta>
        <Text style={{ color: c.texto, fontSize: 16, fontWeight: '800', marginBottom: 4 }} titulo>
          Mis datos
        </Text>
        <FichaUsuario usuario={usuario} campana={usuario.campana?.nombre ?? ''} sinCabecera />
      </Tarjeta>

      {editando && (
        <EditarDatos
          usuario={usuario}
          onGuardado={guardado}
          onCerrar={() => setEditando(false)}
          onFoto={elegirFoto}
          onQuitarFoto={borrarFoto}
          onContrasena={cambiarContrasena}
        />
      )}
    </>
  )
}
