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
import Modal from '../comunes/Modal'
import FichaUsuario from '../perfil/FichaUsuario'
import { fotoCuadrada } from './foto'
import Obligatorio from '../comunes/Obligatorio'

// Mi perfil: los datos del usuario que inició sesión (solo para ver). Desde
// "Editar mis datos" se cambia la foto, se modifican los datos (nombre,
// apellido, correo, teléfono y dirección) y se pide el enlace para cambiar la
// contraseña (igual que en la app móvil). El documento, el rol, la campaña y el
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

function EditarDatos({ usuario, onGuardado, onCerrar, onFoto, onQuitarFoto, onContrasena }) {
  // Acción abierta arriba del formulario: 'quitar' | 'contrasena'
  const [accion, setAccion] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const archivo = useRef(null)

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
  function elegirFoto(e) {
    const elegido = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (elegido) hacer(() => onFoto(elegido))
  }
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
        {etiqueta}
        {opcional ? <span className="opcional"> (opcional)</span> : <Obligatorio />}
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
      {/* Foto de perfil y contraseña (solo se cambian desde acá) */}
      <div className="editar-cuenta">
        <Avatar usuario={usuario} className="ficha__avatar" />
        <div className="editar-cuenta__botones">
          <button type="button" className="boton boton--borde boton--chico" onClick={() => archivo.current?.click()} disabled={ocupado}>
            <Camera size={16} aria-hidden="true" />
            {ocupado && !accion ? 'Subiendo…' : usuario.foto ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {usuario.foto && (
            <button type="button" className="boton boton--borde boton--chico" onClick={() => abrir('quitar')} disabled={ocupado}>
              <Trash2 size={16} aria-hidden="true" />
              Quitar foto
            </button>
          )}
          <button type="button" className="boton boton--borde boton--chico" onClick={() => abrir('contrasena')} disabled={ocupado}>
            <KeyRound size={16} aria-hidden="true" />
            Cambiar contraseña
          </button>
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={elegirFoto} />
        </div>
      </div>
      {accion === 'quitar' && (
        <div className="editar-cuenta__confirmar" role="group" aria-label="Quitar foto">
          <p>¿Desea quitar su foto de perfil? Se mostrará la inicial de su nombre.</p>
          <div>
            <button type="button" className="boton boton--borde boton--chico" onClick={() => setAccion(null)}>
              Cancelar
            </button>
            <button type="button" className="boton boton--peligro boton--chico" onClick={() => hacer(onQuitarFoto)} disabled={ocupado}>
              Quitar
            </button>
          </div>
        </div>
      )}
      {accion === 'contrasena' && (
        <div className="editar-cuenta__confirmar" role="group" aria-label="Cambiar contraseña">
          <p>
            Se enviará a <b>{usuario.email}</b> un enlace para elegir una contraseña nueva. Su contraseña actual sigue
            funcionando hasta que elija la nueva.
          </p>
          <div>
            <button type="button" className="boton boton--borde boton--chico" onClick={() => setAccion(null)}>
              Cancelar
            </button>
            <button type="button" className="boton boton--chico" onClick={() => hacer(onContrasena)} disabled={ocupado}>
              {ocupado ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </div>
        </div>
      )}
      <AvisoOk>{mensaje}</AvisoOk>
      {errorAccion && (
        <p className="aviso-error" role="alert">
          {errorAccion}
        </p>
      )}

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
  const [aviso, setAviso] = useState('')
  // Correo nuevo que todavía falta confirmar desde el enlace
  const [correoPendiente, setCorreoPendiente] = useState('')

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

  async function elegirFoto(elegido) {
    onCambio(await guardarFoto(await fotoCuadrada(elegido)))
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
      cambioUsuario
        ? `Sus datos se guardaron. Su nombre de usuario ahora es «${nuevo.username}»: úselo para ingresar.`
        : 'Sus datos se guardaron correctamente.',
    )
    setCorreoPendiente(correoPendiente || '')
  }

  return (
    <>
      <div className="perfil-acciones">
        <button type="button" className="boton" onClick={() => setEditando(true)}>
          <Pencil size={17} aria-hidden="true" />
          Editar mis datos
        </button>
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
      {/* La foto solo se ve: se cambia desde "Editar mis datos" */}
      <FichaUsuario usuario={usuario} campana={usuario.campana?.nombre ?? ''} />

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

export default MiPerfil
