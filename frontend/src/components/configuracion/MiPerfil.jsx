import { useEffect, useRef, useState } from 'react'
import { Camera, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { guardarFoto, guardarPerfil, pedirCambioDeContrasena, quitarFoto, usuarioActual } from '../../api/auth'
import { errorEmail, errorPersona, useConCambios } from '../../validaciones'
import Avatar from '../comunes/Avatar'
import AvisoOk from '../comunes/AvisoOk'
import Confirmacion from '../comunes/Confirmacion'
import Modal from '../comunes/Modal'
import FichaUsuario from '../perfil/FichaUsuario'
import { fotoCuadrada } from './foto'

// Mi perfil: los datos del usuario que inició sesión. Puede cambiar su foto,
// modificar sus datos (nombre, apellido, correo, teléfono y dirección) y pedir
// el enlace para cambiar la contraseña. El documento, el rol, la campaña y el
// equipo los cambia la administración; el nombre de usuario lo arma el sistema.

function errorTelefono(valor) {
  const texto = valor.trim()
  if (!texto) return ''
  const cifras = texto.replace(/\D/g, '').length
  return /^\+?[\d\s()-]+$/.test(texto) && cifras >= 8 && cifras <= 15 ? '' : 'El teléfono debe tener entre 8 y 15 números.'
}

function EditarDatos({ usuario, onGuardado, onCerrar }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre ?? '',
    apellido: usuario.apellido ?? '',
    email: usuario.email ?? '',
    telefono: usuario.telefono ?? '',
    direccion: usuario.direccion ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  // Se validan mientras se escribe
  const errores = {
    nombre: form.nombre.trim() ? errorPersona(form.nombre) : 'Ingrese el nombre.',
    apellido: errorPersona(form.apellido, 'El apellido'),
    email: errorEmail(form.email),
    telefono: errorTelefono(form.telefono),
  }
  const valido = !Object.values(errores).some(Boolean)

  async function guardar(e) {
    e.preventDefault()
    if (!valido) return
    setError('')
    setGuardando(true)
    try {
      onGuardado(await guardarPerfil(form))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  const campo = (nombre, etiqueta, props = {}, opcional = false) => (
    <label>
      <span>
        {etiqueta} {opcional && <span className="opcional">(opcional)</span>}
      </span>
      <input
        className="entrada"
        value={form[nombre]}
        onChange={cambiar(nombre)}
        aria-invalid={Boolean(errores[nombre])}
        autoComplete="off"
        {...props}
      />
      {errores[nombre] && <small className="texto-error">{errores[nombre]}</small>}
    </label>
  )

  return (
    <Modal titulo="Editar mis datos" onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar} noValidate>
        <div className="formulario-modal__fila">
          {campo('nombre', 'Nombre', { maxLength: 150, autoCapitalize: 'words' })}
          {campo('apellido', 'Apellido', { maxLength: 150, autoCapitalize: 'words' }, true)}
        </div>
        {campo('email', 'Correo electrónico', { type: 'email', inputMode: 'email', maxLength: 254 })}
        <div className="formulario-modal__fila">
          {campo('telefono', 'Teléfono', { type: 'tel', inputMode: 'tel', maxLength: 20 }, true)}
          <label>
            Documento
            <input className="entrada" value={usuario.documento || 'Sin cargar'} disabled readOnly />
          </label>
        </div>
        {campo('direccion', 'Dirección', { maxLength: 200, autoCapitalize: 'sentences' }, true)}
        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !valido || !conCambios}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function MiPerfil({ usuario, onCambio }) {
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(null) // 'contrasena' | 'foto'
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const archivo = useRef(null)

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

  async function cambiarContrasena() {
    setError('')
    try {
      const r = await pedirCambioDeContrasena()
      setAviso(`Se envió a ${r.email} un enlace para elegir una contraseña nueva. Revise su correo.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setConfirmando(null)
    }
  }

  async function elegirFoto(e) {
    const elegido = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!elegido) return
    setError('')
    setSubiendo(true)
    try {
      onCambio(await guardarFoto(await fotoCuadrada(elegido)))
      setAviso('Se actualizó su foto de perfil.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function borrarFoto() {
    setError('')
    try {
      onCambio(await quitarFoto())
      setAviso('Se quitó su foto de perfil.')
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirmando(null)
    }
  }

  function guardado(nuevo) {
    const cambioUsuario = nuevo.username !== usuario.username
    onCambio(nuevo)
    setEditando(false)
    setAviso(
      cambioUsuario
        ? `Sus datos se guardaron. Su nombre de usuario ahora es «${nuevo.username}»: úselo para ingresar.`
        : 'Sus datos se guardaron correctamente.',
    )
  }

  const avatar = (
    <button
      type="button"
      className="foto-perfil"
      onClick={() => archivo.current?.click()}
      disabled={subiendo}
      aria-label="Cambiar la foto de perfil"
      title="Cambiar la foto de perfil"
    >
      <Avatar usuario={usuario} className="ficha__avatar" />
      <span className="foto-perfil__camara" aria-hidden="true">
        <Camera size={15} />
      </span>
    </button>
  )

  return (
    <>
      <div className="perfil-acciones">
        <button type="button" className="boton" onClick={() => setEditando(true)}>
          <Pencil size={17} aria-hidden="true" />
          Editar mis datos
        </button>
        <button type="button" className="boton boton--borde" onClick={() => archivo.current?.click()} disabled={subiendo}>
          <Camera size={17} aria-hidden="true" />
          {subiendo ? 'Subiendo…' : usuario.foto ? 'Cambiar foto' : 'Subir foto'}
        </button>
        {usuario.foto && (
          <button type="button" className="boton boton--borde" onClick={() => setConfirmando('foto')}>
            <Trash2 size={17} aria-hidden="true" />
            Quitar foto
          </button>
        )}
        <button type="button" className="boton boton--borde" onClick={() => setConfirmando('contrasena')}>
          <KeyRound size={17} aria-hidden="true" />
          Cambiar contraseña
        </button>
        <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={elegirFoto} />
      </div>

      <AvisoOk>{aviso}</AvisoOk>
      {error && (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      )}

      <FichaUsuario usuario={usuario} campana={usuario.campana?.nombre ?? ''} avatar={avatar} />

      {editando && <EditarDatos usuario={usuario} onGuardado={guardado} onCerrar={() => setEditando(false)} />}
      {confirmando === 'contrasena' && (
        <Confirmacion
          titulo="Cambiar contraseña"
          textoConfirmar="Enviar enlace"
          peligro={false}
          onCerrar={() => setConfirmando(null)}
          onConfirmar={cambiarContrasena}
        >
          Se enviará a <b>{usuario.email}</b> un enlace para elegir una contraseña nueva. Su contraseña actual sigue
          funcionando hasta que elija la nueva.
        </Confirmacion>
      )}
      {confirmando === 'foto' && (
        <Confirmacion
          titulo="Quitar foto"
          textoConfirmar="Quitar"
          onCerrar={() => setConfirmando(null)}
          onConfirmar={borrarFoto}
        >
          ¿Desea quitar su foto de perfil? Se mostrará la inicial de su nombre.
        </Confirmacion>
      )}
    </>
  )
}

export default MiPerfil
