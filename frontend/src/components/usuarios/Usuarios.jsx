import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/usuarios'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import './usuarios.css'
import Esqueleto from '../comunes/Esqueleto'
import Interruptor from '../comunes/Interruptor'
import { Eye, KeyRound, Pencil } from 'lucide-react'
import FichaUsuario from '../perfil/FichaUsuario'
import BotonIcono from '../comunes/BotonIcono'
import AvisoOk from '../comunes/AvisoOk'
import { emailValido, errorDocumento, MENSAJE_EMAIL, useConCambios } from '../../validaciones'

const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

// Asterisco rojo de los campos obligatorios (solo al crear)
function Obligatorio({ si }) {
  if (!si) return null
  return (
    <span className="obligatorio" aria-hidden="true">
      {' '}*
    </span>
  )
}

// Alta y edición. No se escribe contraseña: al crear el usuario le llega por
// correo una invitación para elegirla, y después se restablece con la llave.
function FormularioUsuario({ usuario, grupos, onGuardado, onCerrar }) {
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
  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  // Al crear: nombre, apellido, correo y documento son obligatorios (llevan *)
  const nuevo = !usuario
  const errores = {
    nombre: form.nombre.trim() ? '' : 'Ingrese el nombre.',
    apellido: nuevo && !form.apellido.trim() ? 'Ingrese el apellido.' : '',
    email: !form.email.trim() ? 'Ingrese el correo electrónico.' : emailValido(form.email) ? '' : MENSAJE_EMAIL,
    documento: nuevo || form.documento.trim() ? errorDocumento(form.documento.replace(/[.\s]/g, '')) : '',
    grupo: form.grupo !== null || usuario?.es_superusuario ? '' : 'Seleccione el rol del usuario.',
  }
  const verError = (campo) => (tocado ? errores[campo] : '')

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setTocado(true)
    const primero = Object.keys(errores).find((c) => errores[c])
    if (primero) {
      document.getElementById(`usuario-${primero}`)?.focus()
      return
    }
    setGuardando(true)
    const datos = {
      nombre: form.nombre,
      apellido: form.apellido,
      email: form.email.trim(),
      grupos: form.grupo === null ? [] : [form.grupo],
      activo: form.activo,
      documento: form.documento.replace(/[.\s]/g, ''),
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
    <Modal titulo={usuario ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar} noValidate>
        <div className="formulario-modal__fila">
          <label>
            <span>
              Nombre
              <Obligatorio si={nuevo} />
            </span>
            <input
              id="usuario-nombre"
              className="entrada"
              value={form.nombre}
              onChange={cambiar('nombre')}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={150}
              required
              aria-required="true"
              aria-invalid={Boolean(verError('nombre'))}
              autoFocus
            />
            {verError('nombre') && <small className="texto-error">{errores.nombre}</small>}
          </label>
          <label>
            <span>
              Apellido
              <Obligatorio si={nuevo} />
            </span>
            <input
              id="usuario-apellido"
              className="entrada"
              value={form.apellido}
              onChange={cambiar('apellido')}
              autoCapitalize="words"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={150}
              required={nuevo}
              aria-required={nuevo}
              aria-invalid={Boolean(verError('apellido'))}
            />
            {verError('apellido') && <small className="texto-error">{errores.apellido}</small>}
          </label>
        </div>
        <label>
          <span>
            Correo electrónico
            <Obligatorio si={nuevo} />
          </span>
          <input
            id="usuario-email"
            className="entrada"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            enterKeyHint="next"
            maxLength={254}
            placeholder="usuario@correo.com"
            value={form.email}
            onChange={cambiar('email')}
            aria-invalid={Boolean(verError('email'))}
            required
            aria-required="true"
          />
          {verError('email') && <small className="texto-error">{errores.email}</small>}
        </label>

        <fieldset>
          <legend>Rol</legend>
          {grupos.map((g) => (
            <label key={g.id} className="casilla-texto">
              <input
                id={grupos[0]?.id === g.id ? 'usuario-grupo' : undefined}
                type="radio"
                name="rol"
                checked={form.grupo === g.id}
                onChange={() => setForm((f) => ({ ...f, grupo: g.id }))}
              />
              <span>{g.nombre}</span>
            </label>
          ))}
          {verError('grupo') && <small className="texto-error">{errores.grupo}</small>}
        </fieldset>

        <div className="formulario-modal__fila">
          <label>
            <span>
              Documento
              <Obligatorio si={nuevo} />
            </span>
            <input
              id="usuario-documento"
              className="entrada"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={10}
              placeholder="Sin puntos"
              value={form.documento}
              onChange={cambiar('documento')}
              /* El documento es la clave del usuario: no se cambia después de crearlo */
              disabled={!nuevo}
              readOnly={!nuevo}
              required={nuevo}
              aria-required={nuevo}
              aria-invalid={Boolean(verError('documento'))}
            />
            {verError('documento') && <small className="texto-error">{errores.documento}</small>}
          </label>
          <label>
            Teléfono
            <input
              className="entrada"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={20}
              value={form.telefono}
              onChange={cambiar('telefono')}
            />
          </label>
        </div>
        <label>
          <span>
            Dirección <span className="opcional">(opcional)</span>
          </span>
          <input
            className="entrada"
            autoCapitalize="sentences"
            autoComplete="off"
            maxLength={200}
            value={form.direccion}
            onChange={cambiar('direccion')}
          />
        </label>

        <label className="interruptor">
          <input type="checkbox" checked={form.activo} onChange={cambiar('activo')} />
          <span className="interruptor__pista" aria-hidden="true" />
          Activo
        </label>

        {nuevo && (
          <p className="nota-obligatorios">
            Los campos marcados con <span className="obligatorio">*</span> son obligatorios.
          </p>
        )}

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !conCambios}>
            {guardando ? 'Guardando…' : usuario ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Usuarios({ usuario: yo }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const [aviso, setAviso] = useState('')
  const [enviandoA, setEnviandoA] = useState(null) // id del usuario al que se le está enviando el enlace

  useEffect(() => {
    api
      .obtenerUsuarios()
      .then(setDatos)
      .catch((e) => setError(e.message))
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
      const actualizado = u.activo
        ? await api.desactivarUsuario(u.id)
        : await api.editarUsuario(u.id, { activo: true })
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
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Usuarios</h1>
          <p>Personas que trabajan en {yo.campana?.nombre ?? 'la campaña'}.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {tiene(yo, 'core.add_usuario') && (
          <button type="button" className="boton pagina__accion" onClick={() => setEditando('nuevo')} disabled={!datos}>
            + Nuevo usuario
          </button>
        )}
      </header>

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, usuario o correo electrónico" etiqueta="Buscar usuarios" />

      <AvisoOk>{aviso}</AvisoOk>
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      {!datos ? (
        !error && <Esqueleto />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          <b>{datos.usuarios.length ? 'No hay usuarios que coincidan.' : 'Todavía no hay usuarios en esta campaña.'}</b>
        </div>
      ) : (
        <>
          <ul className="tarjetas-lista">
            {paginado.items.map((u) => (
              <li key={u.id} className={`tarjeta-fila${u.activo ? '' : ' tarjeta-fila--apagada'}`}>
                <span className="avatar" aria-hidden="true">
                  {(u.nombre[0] ?? u.email[0]).toUpperCase()}
                  {(u.apellido[0] ?? '').toUpperCase()}
                </span>
                <div className="tarjeta-fila__texto">
                  <h3>
                    {`${u.nombre} ${u.apellido}`.trim() || u.email}
                    {u.id === yo.id && <span className="etiqueta etiqueta--verde">Usted</span>}
                    {!u.activo && <span className="etiqueta">Desactivado</span>}
                  </h3>
                  <p>
                    <b title="Nombre de usuario para ingresar">{u.username}</b> · {u.email}
                  </p>
                  <span className="tarjeta-fila__datos usuarios__grupos">
                    {u.grupos.map((g) => (
                      <span
                        key={g.id}
                        className="etiqueta etiqueta--magenta"
                      >
                        {g.nombre}
                      </span>
                    ))}
                    <span>
                      {u.ultimo_ingreso ? `Último ingreso: ${formatoFecha.format(new Date(u.ultimo_ingreso))}` : 'Nunca ingresó'}
                    </span>
                  </span>
                </div>
                <div className="tarjeta-fila__acciones acciones-iconos">
                  <BotonIcono icono={Eye} etiqueta="Ver datos" onClick={() => setViendo(u)} />
                  {puedeEditar && (
                    <>
                      {/* Uno no puede desactivarse a sí mismo: no se muestra el interruptor */}
                      {u.id !== yo.id && (
                        <Interruptor
                          activo={u.activo}
                          onCambiar={() => cambiarEstado(u)}
                          etiqueta={`Usuario ${u.email} activo`}
                          confirmacion={{
                            titulo: 'Desactivar usuario',
                            mensaje: (
                              <>
                                ¿Desea desactivar a <b>{`${u.nombre} ${u.apellido}`.trim() || u.email}</b>? No podrá
                                iniciar sesión hasta que se vuelva a activar.
                              </>
                            ),
                          }}
                        />
                      )}
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
                        onClick={() => enviarRestablecer(u)}
                      />
                      <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(u)} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Paginacion {...paginado} />
        </>
      )}

      {viendo && (
        <Modal titulo="Datos del usuario" onCerrar={() => setViendo(null)}>
          <FichaUsuario usuario={viendo} />
          <div className="acciones">
            <button type="button" className="boton" onClick={() => setViendo(null)} autoFocus>
              Cerrar
            </button>
          </div>
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
    </main>
  )
}

export default Usuarios