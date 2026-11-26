import { useEffect, useRef, useState } from 'react'
import { Camera, Eye, EyeOff, KeyRound, MailCheck, Pencil, Trash2 } from 'lucide-react'
import { guardarFoto, guardarPerfil, pedirCambioDeContrasena, quitarFoto, usuarioActual } from '../../api/auth'
import {
  armarTelefono,
  cifrasDelNumero,
  conFiltro,
  errorEmail,
  errorPersona,
  erroresTelefono,
  nombrePropio,
  primeraMayuscula,
  separarTelefono,
  sinEspaciosMinusculas,
  soloNumeros,
  useConCambios,
} from '../../validaciones'
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

// Contraseña de la cuenta, para confirmar el cambio de correo. Oculta lo
// escrito (como secureTextEntry) y tiene el ojito para mostrarla.
function ContrasenaActual({ valor, onCambio, error, entrada }) {
  const [ver, setVer] = useState(false)
  return (
    <label>
      <span>Contraseña actual</span>
      <span className="campo-clave">
        <input
          ref={entrada}
          id="perfil-password"
          className="entrada"
          type={ver ? 'text' : 'password'}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={128}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="perfil-password-ayuda"
        />
        <button
          type="button"
          className="campo-clave__ojo"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
          aria-pressed={ver}
        >
          {ver ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
      {error ? (
        <small id="perfil-password-ayuda" className="texto-error">
          {error}
        </small>
      ) : (
        <small id="perfil-password-ayuda" className="campo-clave__ayuda">
          Para cambiar el correo, ingrese la contraseña con la que entra al sistema. Le enviaremos un enlace al correo
          nuevo para confirmarlo.
        </small>
      )}
    </label>
  )
}

function EditarDatos({ usuario, onGuardado, onCerrar }) {
  const [form, setForm] = useState(() => ({
    nombre: usuario.nombre ?? '',
    apellido: usuario.apellido ?? '',
    email: usuario.email ?? '',
    // El teléfono se edita en dos campos: código de área y número
    codigoArea: separarTelefono(usuario.telefono).codigo,
    telefono: separarTelefono(usuario.telefono).numero,
    direccion: usuario.direccion ?? '',
  }))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Contraseña para cambiar el correo (aparte del form: no cuenta como "cambio")
  const [password, setPassword] = useState('')
  const [errorPassword, setErrorPassword] = useState('')
  const entradaPassword = useRef(null)
  const conCambios = useConCambios(form)
  const cambiaCorreo = form.email.trim().toLowerCase() !== (usuario.email ?? '').toLowerCase()
  // Lo que no corresponde a cada campo no se puede escribir (ver conFiltro)
  const FILTROS = {
    nombre: nombrePropio,
    apellido: nombrePropio,
    email: sinEspaciosMinusculas,
    codigoArea: (texto) => soloNumeros(texto).replace(/^0+/, ''),
    // Hasta las cifras que corresponden al código de área (387: 7, 11: 8, 3878: 6)
    telefono: (texto) => soloNumeros(texto).slice(0, cifrasDelNumero(form.codigoArea)),
    direccion: primeraMayuscula,
  }
  const cambiar = (campo) => conFiltro(FILTROS[campo], (valor) => setForm((f) => ({ ...f, [campo]: valor })))

  // Se validan mientras se escribe
  const errores = {
    nombre: form.nombre.trim() ? errorPersona(form.nombre) : 'Ingrese el nombre.',
    apellido: errorPersona(form.apellido, 'El apellido'),
    email: errorEmail(form.email),
    ...erroresTelefono(form.codigoArea, form.telefono, usuario.telefono ?? ''),
  }
  const valido = !Object.values(errores).some(Boolean)

  async function guardar(e) {
    e.preventDefault()
    if (!valido) return
    setError('')
    setErrorPassword('')
    if (cambiaCorreo && !password) {
      setErrorPassword('Ingrese su contraseña para cambiar el correo.')
      entradaPassword.current?.focus()
      return
    }
    setGuardando(true)
    try {
      const { codigoArea, ...datos } = form
      const r = await guardarPerfil({
        ...datos,
        telefono: armarTelefono(codigoArea, form.telefono),
        ...(cambiaCorreo && { password }),
      })
      onGuardado(r.usuario, r.correo_pendiente)
    } catch (err) {
      setGuardando(false)
      if (err.codigo === 'contrasena') {
        setErrorPassword(err.message)
        setPassword('')
        entradaPassword.current?.focus()
      } else setError(err.message)
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
        enterKeyHint="next"
        {...props}
      />
      {errores[nombre] && <small className="texto-error">{errores[nombre]}</small>}
    </label>
  )

  return (
    <Modal titulo="Editar mis datos" onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar} noValidate>
        <div className="formulario-modal__fila">
          {campo('nombre', 'Nombre', { maxLength: 150, autoCapitalize: 'words', autoComplete: 'given-name' })}
          {campo('apellido', 'Apellido', { maxLength: 150, autoCapitalize: 'words', autoComplete: 'family-name' }, true)}
        </div>
        {campo('email', 'Correo electrónico', {
          type: 'email',
          inputMode: 'email',
          autoComplete: 'email',
          autoCapitalize: 'none',
          autoCorrect: 'off',
          spellCheck: false,
          maxLength: 254,
        })}
        {cambiaCorreo && (
          <ContrasenaActual
            valor={password}
            onCambio={(valor) => {
              setPassword(valor)
              setErrorPassword('')
            }}
            error={errorPassword}
            entrada={entradaPassword}
          />
        )}
        <div className="formulario-modal__fila formulario-modal__fila--telefono">
          <label>
            Código de área
            <input
              className="entrada"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel-area-code"
              enterKeyHint="next"
              maxLength={4}
              placeholder="Ej.: 387"
              value={form.codigoArea}
              onChange={cambiar('codigoArea')}
              aria-invalid={Boolean(errores.codigo)}
            />
            {errores.codigo && <small className="texto-error">{errores.codigo}</small>}
          </label>
          {campo(
            'telefono',
            'Teléfono',
            {
              type: 'tel',
              inputMode: 'tel',
              autoComplete: 'tel-local',
              maxLength: cifrasDelNumero(form.codigoArea),
              placeholder: 'Sin el 15',
            },
            true,
          )}
        </div>
        <label>
          Documento
          {/* Solo lectura (editable={false}): el documento lo cambia la administración */}
          <input className="entrada" value={usuario.documento || 'Sin cargar'} disabled readOnly tabIndex={-1} />
        </label>
        {campo('direccion', 'Dirección', { maxLength: 200, autoCapitalize: 'sentences', autoComplete: 'street-address', enterKeyHint: 'done' }, true)}
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
  // Correo nuevo que todavía falta confirmar desde el enlace
  const [correoPendiente, setCorreoPendiente] = useState('')
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

  function guardado(nuevo, correoPendiente) {
    const cambioUsuario = nuevo.username !== usuario.username
    onCambio(nuevo)
    setEditando(false)
    setAviso(
      cambioUsuario
        ? `Sus datos se guardaron. Su nombre de usuario ahora es «${nuevo.username}»: úselo para ingresar.`
        : 'Sus datos se guardaron correctamente.',
    )
    setCorreoPendiente(correoPendiente || '')
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
      {correoPendiente && (
        <div className="aviso-correo" role="status">
          <MailCheck size={20} aria-hidden="true" />
          <p>
            Le enviamos un enlace a <b>{correoPendiente}</b>. Ábralo para confirmar el correo nuevo: hasta entonces su
            cuenta sigue usando <b>{usuario.email}</b>. El enlace vence en 24 horas. Revise también la carpeta de spam.
          </p>
        </div>
      )}
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
