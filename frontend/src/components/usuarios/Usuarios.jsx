import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/usuarios'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import './usuarios.css'

const GRUPO_MILITANTES = 'Militantes'
const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

function FormularioUsuario({ usuario, grupos, onGuardado, onCerrar }) {
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    password: '',
    grupos: usuario?.grupos.map((g) => g.id) ?? [],
    administra: usuario?.administra ?? false,
    activo: usuario?.activo ?? true,
    documento: usuario?.militante?.documento ?? '',
    telefono: usuario?.militante?.telefono ?? '',
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const alternarGrupo = (id) =>
    setForm((f) => ({ ...f, grupos: f.grupos.includes(id) ? f.grupos.filter((g) => g !== id) : [...f.grupos, id] }))
  const idMilitantes = grupos.find((g) => g.nombre === GRUPO_MILITANTES)?.id
  const esMilitante = form.grupos.includes(idMilitantes) || !!usuario?.militante

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    const datos = {
      nombre: form.nombre,
      apellido: form.apellido,
      email: form.email,
      grupos: form.grupos,
      administra: form.administra,
      activo: form.activo,
      militante: esMilitante ? { documento: form.documento, telefono: form.telefono } : null,
      ...(form.password && { password: form.password }),
    }
    try {
      onGuardado(usuario ? await api.editarUsuario(usuario.id, datos) : await api.crearUsuario(datos), !usuario)
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={usuario ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar}>
        <div className="formulario-modal__fila">
          <label>
            Nombre
            <input className="entrada" value={form.nombre} onChange={cambiar('nombre')} required autoFocus />
          </label>
          <label>
            Apellido
            <input className="entrada" value={form.apellido} onChange={cambiar('apellido')} />
          </label>
        </div>
        <label>
          Email (con este ingresa)
          <input className="entrada" type="email" value={form.email} onChange={cambiar('email')} required />
        </label>
        <label>
          {usuario ? 'Nueva contraseña' : 'Contraseña'}{' '}
          {usuario && <span className="opcional">(dejala vacía para no cambiarla)</span>}
          <input
            className="entrada"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={cambiar('password')}
            required={!usuario}
            minLength={8}
          />
        </label>

        <fieldset>
          <legend>Roles</legend>
          {grupos.map((g) => (
            <label key={g.id} className="casilla-texto">
              <input type="checkbox" checked={form.grupos.includes(g.id)} onChange={() => alternarGrupo(g.id)} />
              <span>
                {g.nombre}
                <span className="opcional"> (rol)</span>
                <small>
                  {g.descripcion || (g.nombre === GRUPO_MILITANTES ? 'Solo carga encuestas.' : 'Permisos definidos en Gestión → Roles.')}
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        {esMilitante && (
          <div className="formulario-modal__fila">
            <label>
              Documento <span className="opcional">(opcional)</span>
              <input className="entrada" inputMode="numeric" value={form.documento} onChange={cambiar('documento')} />
            </label>
            <label>
              Teléfono <span className="opcional">(opcional)</span>
              <input className="entrada" type="tel" value={form.telefono} onChange={cambiar('telefono')} />
            </label>
          </div>
        )}

        <label className="interruptor">
          <input type="checkbox" checked={form.activo} onChange={cambiar('activo')} />
          <span className="interruptor__pista" aria-hidden="true" />
          Activo (puede ingresar)
        </label>

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}
        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
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
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api
      .obtenerUsuarios()
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const lista = datos?.usuarios ?? []
    if (!texto) return lista
    return lista.filter((u) => `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(texto))
  }, [datos, busqueda])

  const reemplazar = (u, nuevo) =>
    setDatos((d) => ({ ...d, usuarios: nuevo ? [u, ...d.usuarios] : d.usuarios.map((x) => (x.id === u.id ? u : x)) }))

  async function cambiarEstado(u) {
    try {
      const actualizado = u.activo
        ? await api.desactivarUsuario(u.id)
        : await api.editarUsuario(u.id, { activo: true })
      reemplazar(actualizado)
      setAviso(actualizado.activo ? 'Usuario activado.' : 'Usuario desactivado: ya no puede ingresar.')
    } catch (e) {
      setError(e.message)
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

      <div className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por nombre o email"
          aria-label="Buscar usuarios"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {aviso && (
        <p className="aviso-ok" role="status">
          {aviso}
        </p>
      )}
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      {!datos ? (
        !error && <p className="vacio-tarjeta">Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          <b>{datos.usuarios.length ? 'No hay usuarios que coincidan.' : 'Todavía no hay usuarios en esta campaña.'}</b>
        </div>
      ) : (
        <ul className="tarjetas-lista">
          {visibles.map((u) => (
            <li key={u.id} className={`tarjeta-fila${u.activo ? '' : ' tarjeta-fila--apagada'}`}>
              <span className="avatar" aria-hidden="true">
                {(u.nombre[0] ?? u.email[0]).toUpperCase()}
                {(u.apellido[0] ?? '').toUpperCase()}
              </span>
              <div className="tarjeta-fila__texto">
                <h3>
                  {`${u.nombre} ${u.apellido}`.trim() || u.email}
                  {u.id === yo.id && <span className="etiqueta etiqueta--verde">Vos</span>}
                  {!u.activo && <span className="etiqueta">Desactivado</span>}
                </h3>
                <p>{u.email}</p>
                <span className="tarjeta-fila__datos usuarios__grupos">
                  {u.administra && <span className="etiqueta etiqueta--violeta">Administra la campaña</span>}
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
              {puedeEditar && (
                <div className="tarjeta-fila__acciones">
                  <button type="button" className="boton boton--borde boton--chico" onClick={() => setEditando(u)}>
                    Editar
                  </button>
                  {u.id !== yo.id && (
                    <button
                      type="button"
                      className={`boton boton--chico ${u.activo ? 'boton--peligro' : 'boton--borde'}`}
                      onClick={() => cambiarEstado(u)}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioUsuario
          usuario={editando === 'nuevo' ? null : editando}
          grupos={datos.grupos}
          onCerrar={() => setEditando(null)}
          onGuardado={(u, nuevo) => {
            reemplazar(u, nuevo)
            setEditando(null)
            setAviso(nuevo ? `Usuario ${u.email} creado.` : 'Cambios guardados.')
          }}
        />
      )}
    </main>
  )
}

export default Usuarios