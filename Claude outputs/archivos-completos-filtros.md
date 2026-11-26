# Archivos completos: filtros de los campos

Cada archivo va entero. Reemplazá el contenido completo del archivo que está en esa ruta.

## Índice

1. `frontend/src/validaciones.js`
2. `frontend/src/components/usuarios/Usuarios.jsx`
3. `frontend/src/components/configuracion/MiPerfil.jsx`
4. `frontend/src/components/responder/ResponderCuestionario.jsx`
5. `frontend/src/components/login/Login.jsx`
6. `frontend/src/components/login/Olvide.jsx`
7. `frontend/src/components/categorias/Categorias.jsx`
8. `frontend/src/components/campanas/ElegirCampana.jsx`
9. `frontend/src/components/equipos/equipos.jsx`
10. `frontend/src/components/grupos/grupos.jsx`
11. `frontend/src/components/mapa/PanelZonas.jsx`
12. `frontend/src/components/mapa/PanelRutas.jsx`
13. `frontend/src/components/cuestionarios/EditorCuestionario.jsx`


---

## 1. `frontend/src/validaciones.js`

```javascript
// Reglas de los formularios. Son las mismas que aplica el backend
// (backend/core/validaciones.py): lo que se acepta acá se acepta allá.
import { useState } from 'react'

// Correo: la regex del documento de validación (usuario@dominio.com) sin puntos seguidos en el dominio
export const REGLA_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/
export const REGLA_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$/

export const MENSAJE_EMAIL = 'Ingrese un correo electrónico válido (por ejemplo, usuario@correo.com).'
export const MENSAJE_CONTRASENA =
  'La contraseña debe tener al menos 8 caracteres, con una mayúscula, una minúscula y un número.'

export const emailValido = (valor) => REGLA_EMAIL.test(String(valor ?? '').trim())
export const contrasenaValida = (valor) => REGLA_CONTRASENA.test(String(valor ?? ''))

// Mensaje de error del correo ('' si está bien). Vacío: pide ingresarlo.
export function errorEmail(valor) {
  if (!String(valor ?? '').trim()) return 'Ingrese su correo electrónico.'
  return emailValido(valor) ? '' : MENSAJE_EMAIL
}

// Nombre de usuario del login (apellido + inicial del nombre; el correo no se acepta)
export function errorUsuario(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return 'Ingrese su nombre de usuario.'
  if (texto.includes('@')) return 'Ingrese su nombre de usuario (apellido + inicial del nombre), no el correo.'
  return /\s/.test(texto) ? 'El nombre de usuario no lleva espacios.' : ''
}

// ---------------------------------------------------------------------------
// Filtros mientras se escribe: lo que no se acepta ni siquiera aparece en el
// campo (como keyboardType + maxLength + autoCapitalize de TextInput, pero
// también en la computadora). Son las mismas reglas que valida el backend.
// ---------------------------------------------------------------------------

// Sin espacios al principio ni dos seguidos (el espacio del final se deja:
// hace falta para escribir la palabra siguiente)
const espaciado = (texto) => texto.replace(/^\s+/, '').replace(/[ \t]{2,}/g, ' ')

// Documento, teléfono, código de área: solo números
export const soloNumeros = (texto) => texto.replace(/\D/g, '')

// Nombre y apellido de una persona: letras, espacio, ' y -, con mayúscula al
// principio de cada palabra ("maría josé" → "María José", "o'connor" → "O'Connor")
export const nombrePropio = (texto) =>
  espaciado(texto.replace(/[^\p{L}\s'-]/gu, '')).replace(/(^|[\s'-])(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase())

// Primera letra en mayúscula (oraciones: descripciones, direcciones)
// (también después de ¿ ¡ « " o paréntesis: "¿cuál…" → "¿Cuál…")
export const primeraMayuscula = (texto) =>
  texto.replace(/^\s+/, '').replace(/^([¿¡«"'(]*)(\p{L})/u, (_, signos, letra) => signos + letra.toUpperCase())

// Nombre de una cosa (campaña, categoría, equipo, rol, zona, ruta): letras,
// números, espacios y . , - ' ( ) / º °, empezando con mayúscula
export const nombreCosa = (texto) => primeraMayuscula(espaciado(texto.replace(/[^\p{L}\p{N}\s.,'()/º°-]/gu, '')))

// Título, preguntas y opciones de un cuestionario: sin símbolos como @ # $ * _ = < > { } [ ] | \ ~ `
export const textoLibre = (texto) => primeraMayuscula(texto.replace(/[@#$^*_=<>{}[\]|\\~`]/g, ''))

// Correo y nombre de usuario: sin espacios y en minúsculas
export const sinEspaciosMinusculas = (texto) => texto.replace(/\s/g, '').toLowerCase()

// Teléfono escrito entero (Mi perfil): números, espacios, ( ) - y + adelante
export const telefonoLibre = (texto) => texto.replace(/[^\d\s()+-]/g, '').replace(/(?!^)\+/g, '')

// onChange de un campo con filtro. Si el filtro saca o cambia letras, el
// cursor queda donde estaba (y no salta al final del texto).
export function conFiltro(filtro, guardar) {
  return (e) => {
    const campo = e.target
    const escrito = campo.value
    const limpio = filtro(escrito)
    guardar(limpio)
    if (limpio === escrito) return
    const posicion = Math.max(0, (campo.selectionStart ?? escrito.length) - (escrito.length - limpio.length))
    requestAnimationFrame(() => {
      try {
        if (document.activeElement === campo) campo.setSelectionRange(posicion, posicion)
      } catch {
        // type="email" no permite mover el cursor: queda al final
      }
    })
  }
}

// Persona encuestada: DNI de 7 u 8 números y nombre o apellido solo con letras
export const REGLA_DNI = /^\d{7,8}$/
export const REGLA_PERSONA = /^\p{L}+(?:[ '-]\p{L}+)*$/u

export function errorDocumento(valor) {
  if (!valor) return 'Ingrese el documento.'
  return REGLA_DNI.test(valor) ? '' : 'El documento debe tener 7 u 8 números, sin puntos.'
}

export function errorPersona(valor, campo = 'El nombre') {
  const texto = String(valor ?? '').trim()
  if (!texto) return ''
  if (texto.length < 2) return `${campo} es muy corto.`
  return REGLA_PERSONA.test(texto) ? '' : `${campo} solo admite letras y espacios.`
}

// Requisitos de la contraseña, para mostrarlos tildados mientras se escribe
export const requisitosContrasena = (valor = '') => [
  { texto: 'Al menos 8 caracteres', ok: valor.length >= 8 },
  { texto: 'Una letra mayúscula', ok: /[A-Z]/.test(valor) },
  { texto: 'Una letra minúscula', ok: /[a-z]/.test(valor) },
  { texto: 'Un número', ok: /[0-9]/.test(valor) },
]

// Formularios: guarda los valores con los que se abrió y avisa si hubo cambios,
// para deshabilitar "Guardar" mientras no se modificó nada.
const comparable = (valor) => JSON.stringify(valor, (_, v) => (typeof v === 'string' ? v.trim() : v))

export function useConCambios(valores) {
  const [inicial] = useState(() => comparable(valores))
  return comparable(valores) !== inicial
}
```


---

## 2. `frontend/src/components/usuarios/Usuarios.jsx`

```jsx
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
import { conFiltro, emailValido, errorDocumento, MENSAJE_EMAIL, nombrePropio, primeraMayuscula, sinEspaciosMinusculas, soloNumeros, useConCambios } from '../../validaciones'

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

// Teléfono: se guarda como "(387) 4123456", con el código de área entre
// paréntesis. Al editar se separa en los dos campos; uno cargado antes sin
// código queda entero en el campo del número.
function separarTelefono(texto) {
  const valor = String(texto ?? '')
  const m = valor.match(/^\((\d{2,4})\)\s*(.*)$/)
  return m ? { codigo: m[1], numero: m[2] } : { codigo: '', numero: valor }
}

// Código de área sin el 0 y número sin el 15: entre los dos, 10 cifras
// (11 + 8, 387 + 7, 3878 + 6)
function erroresTelefono(codigo, numero, original) {
  const cifras = numero.replace(/\D/g, '')
  if (!numero.trim()) return { codigo: '', telefono: '' }
  // Un teléfono ya guardado que no se tocó se acepta como está
  if (!codigo && numero === original) return { codigo: '', telefono: '' }
  if (!codigo) return { codigo: 'Ingrese el código de área.', telefono: '' }
  if (!/^\d{2,4}$/.test(codigo)) return { codigo: 'De 2 a 4 números, sin el 0.', telefono: '' }
  if (cifras.length !== 10 - codigo.length)
    return { codigo: '', telefono: `Con el código ${codigo}, el número lleva ${10 - codigo.length} cifras (sin el 15).` }
  return { codigo: '', telefono: '' }
}

// Alta y edición. No se escribe contraseña: al crear el usuario le llega por
// correo una invitación para elegirla, y después se restablece con la llave.
function FormularioUsuario({ usuario, grupos, onGuardado, onCerrar }) {
  const [form, setForm] = useState(() => ({
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    email: usuario?.email ?? '',
    grupo: usuario?.grupos[0]?.id ?? null,
    activo: usuario?.activo ?? true,
    documento: usuario?.documento ?? '',
    codigoArea: separarTelefono(usuario?.telefono).codigo,
    telefono: separarTelefono(usuario?.telefono).numero,
    direccion: usuario?.direccion ?? '',
  }))
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  // Campos de texto: lo que no corresponde no se puede escribir (ver conFiltro)
  const escribir = (campo, filtro) => conFiltro(filtro, (valor) => setForm((f) => ({ ...f, [campo]: valor })))
  // Al crear: nombre, apellido, correo y documento son obligatorios (llevan *)
  const nuevo = !usuario
  const errores = {
    nombre: form.nombre.trim() ? '' : 'Ingrese el nombre.',
    apellido: nuevo && !form.apellido.trim() ? 'Ingrese el apellido.' : '',
    email: !form.email.trim() ? 'Ingrese el correo electrónico.' : emailValido(form.email) ? '' : MENSAJE_EMAIL,
    documento: nuevo || form.documento.trim() ? errorDocumento(form.documento.replace(/[.\s]/g, '')) : '',
    grupo: form.grupo !== null || usuario?.es_superusuario ? '' : 'Seleccione el rol del usuario.',
    ...erroresTelefono(form.codigoArea, form.telefono, usuario?.telefono ?? ''),
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
      telefono: form.codigoArea && form.telefono.trim() ? `(${form.codigoArea}) ${form.telefono.trim()}` : form.telefono.trim(),
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
              onChange={escribir('nombre', nombrePropio)}
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
              onChange={escribir('apellido', nombrePropio)}
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
            onChange={escribir('email', sinEspaciosMinusculas)}
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

        <label>
          <span>
            Documento
            <Obligatorio si={nuevo} />
          </span>
          <input
            id="usuario-documento"
            className="entrada"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="next"
            maxLength={8}
            placeholder="Solo números, sin puntos"
            value={form.documento}
            onChange={escribir('documento', soloNumeros)}
            /* El documento es la clave del usuario: no se cambia después de crearlo */
            disabled={!nuevo}
            readOnly={!nuevo}
            required={nuevo}
            aria-required={nuevo}
            aria-invalid={Boolean(verError('documento'))}
          />
          {verError('documento') && <small className="texto-error">{errores.documento}</small>}
        </label>
        <div className="formulario-modal__fila usuarios__telefono">
          <label>
            Código de área
            <input
              id="usuario-codigo"
              className="entrada"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={4}
              placeholder="Ej.: 387"
              value={form.codigoArea}
              onChange={escribir('codigoArea', (texto) => soloNumeros(texto).replace(/^0+/, ''))}
              aria-invalid={Boolean(verError('codigo'))}
            />
            {verError('codigo') && <small className="texto-error">{errores.codigo}</small>}
          </label>
          <label>
            <span>
              Teléfono <span className="opcional">(opcional)</span>
            </span>
            <input
              id="usuario-telefono"
              className="entrada"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={8}
              placeholder="Sin el 15"
              value={form.telefono}
              onChange={escribir('telefono', soloNumeros)}
              aria-invalid={Boolean(verError('telefono'))}
            />
            {verError('telefono') && <small className="texto-error">{errores.telefono}</small>}
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
            enterKeyHint="done"
            maxLength={200}
            value={form.direccion}
            onChange={escribir('direccion', primeraMayuscula)}
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
```


---

## 3. `frontend/src/components/configuracion/MiPerfil.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import { Camera, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { guardarFoto, guardarPerfil, pedirCambioDeContrasena, quitarFoto, usuarioActual } from '../../api/auth'
import { conFiltro, errorEmail, errorPersona, nombrePropio, primeraMayuscula, sinEspaciosMinusculas, telefonoLibre, useConCambios } from '../../validaciones'
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
  // Lo que no corresponde a cada campo no se puede escribir (ver conFiltro)
  const FILTROS = {
    nombre: nombrePropio,
    apellido: nombrePropio,
    email: sinEspaciosMinusculas,
    telefono: telefonoLibre,
    direccion: primeraMayuscula,
  }
  const cambiar = (campo) => conFiltro(FILTROS[campo], (valor) => setForm((f) => ({ ...f, [campo]: valor })))

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
        <div className="formulario-modal__fila">
          {campo('telefono', 'Teléfono', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', maxLength: 20 }, true)}
          <label>
            Documento
            {/* Solo lectura (editable={false}): el documento lo cambia la administración */}
            <input className="entrada" value={usuario.documento || 'Sin cargar'} disabled readOnly tabIndex={-1} />
          </label>
        </div>
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
```


---

## 4. `frontend/src/components/responder/ResponderCuestionario.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import * as api from '../../api/encuestas'
import { conFiltro, errorDocumento, errorPersona, nombrePropio, soloNumeros } from '../../validaciones'
import '../cuestionarios/cuestionarios.css'
import './responder.css'

// Carga de una encuesta (datos de la persona + respuestas), con el mismo
// formato de tarjetas que el editor. Los errores se marcan en el momento: el
// documento y los nombres al salir del campo (y mientras se corrigen), y una
// pregunta obligatoria sin responder apenas se responde una posterior.

const ENCUESTADO_VACIO = { documento: '', nombre: '', apellido: '' }

function Pregunta({ pregunta, numero, elegidas, error, onCambio }) {
  const multiple = pregunta.tipo === 'opcion_multiple'
  const nombre = `pregunta-${pregunta.id}`

  function alternar(id) {
    if (!multiple) onCambio([id])
    else onCambio(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id])
  }

  return (
    <fieldset className={`tarjeta-form respuesta${error ? ' respuesta--error' : ''}`}>
      <legend className="respuesta__enunciado">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <span>
          {pregunta.enunciado}
          {pregunta.obligatoria && (
            <span className="respuesta__obligatoria" aria-label="obligatoria">
              {' '}
              *
            </span>
          )}
          {multiple && <span className="respuesta__ayuda">Puede elegir varias opciones</span>}
        </span>
      </legend>

      <div className="respuesta__opciones">
        {pregunta.opciones.map((o) => (
          <label key={o.id} className="respuesta__opcion">
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={nombre}
              checked={elegidas.includes(o.id)}
              onChange={() => alternar(o.id)}
            />
            <span>{o.texto}</span>
          </label>
        ))}
        {!pregunta.obligatoria && !multiple && elegidas.length > 0 && (
          <button type="button" className="enlace-boton respuesta__limpiar" onClick={() => onCambio([])}>
            Borrar selección
          </button>
        )}
      </div>

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function ResponderCuestionario() {
  const { id } = useParams()
  const [cuestionario, setCuestionario] = useState(null)
  const [encuestado, setEncuestado] = useState(ENCUESTADO_VACIO)
  const [respuestas, setRespuestas] = useState({})
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  // Campos de la persona que ya se tocaron (sus errores se muestran desde ahí)
  const [tocados, setTocados] = useState({})
  const erroresPersona = {
    documento: errorDocumento(encuestado.documento),
    nombre: errorPersona(encuestado.nombre),
    apellido: errorPersona(encuestado.apellido, 'El apellido'),
  }
  const errorDe = (campo) => (tocados[campo] ? erroresPersona[campo] : '')
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }))

  useEffect(() => {
    api
      .obtenerCuestionarioParaResponder(id)
      .then(setCuestionario)
      .catch((e) => setError(e.message))
  }, [id])

  // El documento admite solo números, hasta 8; el nombre y el apellido, solo
  // letras, con mayúscula al principio de cada palabra
  const cambiarEncuestado = (campo) =>
    conFiltro(campo === 'documento' ? (texto) => soloNumeros(texto).slice(0, 8) : nombrePropio, (valor) => {
      setEncuestado((d) => ({ ...d, [campo]: valor }))
      // Un nombre muy corto muestra el error mientras se escribe
      if (campo !== 'documento' && errorPersona(valor.trim())) setTocados((t) => ({ ...t, [campo]: true }))
    })

  function responder(pregunta, valor) {
    setRespuestas((r) => ({ ...r, [pregunta]: valor }))
    // Las obligatorias anteriores que quedaron sin responder se marcan en el momento
    const indice = cuestionario.preguntas.findIndex((p) => p.id === pregunta)
    setErrores((e) => {
      const nuevos = { ...e, [pregunta]: '' }
      cuestionario.preguntas.slice(0, indice).forEach((p) => {
        if (p.obligatoria && !(respuestas[p.id]?.length > 0)) nuevos[p.id] = 'Esta pregunta es obligatoria.'
      })
      return nuevos
    })
    setError('')
  }

  function validar() {
    const faltan = {}
    for (const p of cuestionario.preguntas) {
      if (p.obligatoria && !(respuestas[p.id]?.length > 0)) faltan[p.id] = 'Esta pregunta es obligatoria.'
    }
    setErrores(faltan)
    return Object.keys(faltan).length === 0
  }

  async function enviar(evento) {
    evento.preventDefault()
    setError('')
    setTocados({ documento: true, nombre: true, apellido: true })
    const preguntasBien = validar()
    if (!preguntasBien || Object.values(erroresPersona).some(Boolean)) {
      setError('Revise los campos marcados en rojo.')
      return
    }
    setEnviando(true)
    try {
      await api.enviarRespuestas(id, {
        encuestado,
        respuestas: cuestionario.preguntas
          .filter((p) => respuestas[p.id]?.length > 0)
          .map((p) => ({ pregunta: p.id, opciones: respuestas[p.id] })),
      })
      setEnviado(true)
      window.scrollTo({ top: 0 })
      document.querySelector('.editor')?.scrollTo({ top: 0 })
    } catch (e) {
      setError(e.message)
      document.querySelector('.editor')?.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setEnviando(false)
    }
  }

  function otraEncuesta() {
    setEncuestado(ENCUESTADO_VACIO)
    setTocados({})
    setRespuestas({})
    setErrores({})
    setError('')
    setEnviado(false)
  }

  if (!cuestionario) {
    return (
      <main className="editor">
        <div className="editor__columna">
          {error ? <p className="aviso-error">{error}</p> : <p className="vacio-tarjeta">Cargando…</p>}
        </div>
      </main>
    )
  }

  if (enviado) {
    return (
      <main className="editor">
        <div className="editor__columna">
          <section className="tarjeta-form tarjeta-titulo respuesta-enviada">
            <span className="respuesta-enviada__icono" aria-hidden="true">
              ✓
            </span>
            <h1>¡Encuesta guardada!</h1>
            <p>
              Se registró la respuesta para <b>{cuestionario.titulo}</b>.
            </p>
            <div className="acciones acciones--centro">
              <Link to="/responder" className="boton boton--borde">
                Volver a encuestas
              </Link>
              <button type="button" className="boton" onClick={otraEncuesta}>
                Cargar otra encuesta
              </button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <form className="editor" onSubmit={enviar} noValidate>
      <div className="editor__barra">
        <Link to="/responder" className="enlace-volver">
          ← Encuestas
        </Link>
        <span className="editor__estado" />
      </div>

      <div className="editor__columna">
        <section className="tarjeta-form tarjeta-titulo">
          <span className="chip-categoria">{cuestionario.categoria}</span>
          <h1 className="respuesta__titulo">{cuestionario.titulo}</h1>
          {cuestionario.descripcion && <p className="texto-suave">{cuestionario.descripcion}</p>}
          <p className="respuesta__nota">
            <span className="respuesta__obligatoria">*</span> Indica que la pregunta es obligatoria
          </p>
        </section>

        {error && (
          <p className="aviso-error" role="alert">
            {error}
          </p>
        )}

        <fieldset className="tarjeta-form datos-encuestado">
          <legend className="respuesta__enunciado">Datos de la persona encuestada</legend>
          <div className="datos-encuestado__grilla">
            <label className="datos-encuestado__ancho">
              <span>
                Documento <span className="respuesta__obligatoria">*</span>
              </span>
              <input
                className="entrada"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="next"
                value={encuestado.documento}
                onChange={cambiarEncuestado('documento')}
                onBlur={tocar('documento')}
                placeholder="Sin puntos, 7 u 8 números"
                maxLength={8}
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errorDe('documento'))}
                required
              />
              {errorDe('documento') && <small className="texto-error">{errorDe('documento')}</small>}
            </label>
            <label>
              Nombre
              <input
                className="entrada"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
                maxLength={100}
                value={encuestado.nombre}
                onChange={cambiarEncuestado('nombre')}
                onBlur={tocar('nombre')}
                aria-invalid={Boolean(errorDe('nombre'))}
              />
              {errorDe('nombre') && <small className="texto-error">{errorDe('nombre')}</small>}
            </label>
            <label>
              Apellido
              <input
                className="entrada"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
                maxLength={100}
                value={encuestado.apellido}
                onChange={cambiarEncuestado('apellido')}
                onBlur={tocar('apellido')}
                aria-invalid={Boolean(errorDe('apellido'))}
              />
              {errorDe('apellido') && <small className="texto-error">{errorDe('apellido')}</small>}
            </label>
          </div>
        </fieldset>

        {cuestionario.preguntas.map((p, i) => (
          <Pregunta
            key={p.id}
            pregunta={p}
            numero={i + 1}
            elegidas={respuestas[p.id] ?? []}
            error={errores[p.id]}
            onCambio={(v) => responder(p.id, v)}
          />
        ))}

        <div className="acciones">
          <button type="submit" className="boton boton--grande" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar encuesta'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default ResponderCuestionario
```


---

## 5. `frontend/src/components/login/Login.jsx`

```jsx
// useState: hook de React para guardar valores que cambian (lo que escribe el usuario, errores, etc.)
import { useState } from 'react'
import { Link } from 'react-router'
// iniciarSesion: habla con Django (src/api/auth.js)
import { iniciarSesion, ultimoUsuario } from '../../api/auth'
// Mismas reglas que el backend
import { conFiltro, errorUsuario, sinEspaciosMinusculas } from '../../validaciones'
// Logo del águila (src/assets/logo.png)
import Logo from '../comunes/Logo'
// Olas de colores y foto del fondo (las comparte con Olvide y Restablecer)
import FondoLogin from './FondoLogin'
import CampoContrasena from './CampoContrasena'
import './Login.css'

// Componente Login. Recibe "onIngreso", una función que se ejecuta cuando el login sale bien
// (App.jsx la usa para guardar el usuario y redirigir)
export default function Login({ onIngreso }) {
  // ----- ESTADOS -----
  // Nombre de usuario: apellido + primera letra del nombre (ej: "perezj").
  // Se propone el último que ingresó en este navegador.
  const [nombre, setNombre] = useState(ultimoUsuario)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false) // checkbox "Recordar"
  const [tocados, setTocados] = useState({ nombre: false, password: false })
  const [error, setError] = useState('') // error que devuelve el servidor
  const [loading, setLoading] = useState(false)

  // En el login solo se pide que la contraseña esté escrita: la regla de 8 caracteres,
  // mayúscula, etc. se exige al crearla. Si es incorrecta, el servidor responde
  // siempre el mismo mensaje (no dice si falló el usuario o la contraseña).
  const errores = { nombre: errorUsuario(nombre), password: password ? '' : 'Ingrese su contraseña.' }
  // "Iniciar sesión" se habilita recién cuando los dos campos tienen algo escrito
  const completo = Boolean(nombre.trim() && password)
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }))

  // ----- AL APRETAR "Iniciar sesión" -----
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setTocados({ nombre: true, password: true })
    // Las mismas reglas que valida el backend: si no se cumplen, no se envía
    if (errores.nombre || errores.password) {
      document.getElementById(errores.nombre ? 'usuario' : 'password')?.focus()
      return
    }
    setLoading(true)
    try {
      // "remember" se manda al backend: si es false, la sesión termina al cerrar el navegador
      const usuario = await iniciarSesion(nombre.trim(), password, remember)
      onIngreso?.(usuario)
    } catch (err) {
      setError(err.message || 'Credenciales inválidas. Por favor, verifique su usuario y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  // Los errores aparecen recién al salir del campo o al enviar (no mientras se escribe),
  // así el formulario no cambia de tamaño con cada tecla
  const verError = (campo) => (tocados[campo] ? errores[campo] : '')

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <Logo className="login__logo" fetchPriority="high" />

          <h1>Iniciar sesión</h1>
          <p className="login__subtitle">Ingrese a su cuenta para continuar</p>

          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {/* ----- NOMBRE DE USUARIO: sin mayúsculas ni corrector ----- */}
          <label htmlFor="usuario">Usuario</label>
          <div className={`login__field${verError('nombre') ? ' login__field--error' : ''}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={254}
              placeholder="Usuario"
              value={nombre}
              onChange={conFiltro(sinEspaciosMinusculas, (valor) => {
                setNombre(valor)
                setTocados((t) => ({ ...t, nombre: false }))
              })}
              onBlur={tocar('nombre')}
              aria-invalid={Boolean(verError('nombre'))}
              aria-describedby={verError('nombre') ? 'usuario-error' : undefined}
            />
          </div>
          {verError('nombre') && (
            <p id="usuario-error" className="login__ayuda login__ayuda--error">
              {errores.nombre}
            </p>
          )}

          {/* ----- CONTRASEÑA: oculta, con el ojito para verla ----- */}
          <label htmlFor="password">Contraseña</label>
          <CampoContrasena
            id="password"
            value={password}
            onChange={(valor) => {
              setPassword(valor)
              setTocados((t) => ({ ...t, password: false }))
            }}
            autoComplete="current-password"
            enterKeyHint="go"
            error={verError('password')}
          />

          <div className="login__row">
            <label className="login__check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Recordar</span>
            </label>
            <Link to="/olvide" state={{ usuario: nombre.trim() }}>
              ¿Olvidó su contraseña?
            </Link>
          </div>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          {/* Deshabilitado hasta completar los dos campos y mientras espera al servidor (evita el doble clic) */}
          <button className="login__submit" type="submit" disabled={loading || !completo} aria-busy={loading}>
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}
```


---

## 6. `frontend/src/components/login/Olvide.jsx`

```jsx
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { pedirEnlace, ultimoUsuario } from '../../api/auth'
import { conFiltro, errorUsuario, sinEspaciosMinusculas } from '../../validaciones'
import Logo from '../comunes/Logo'
import FondoLogin from './FondoLogin'
import './Login.css'

// "¿Olvidó su contraseña?" (/olvide): la persona confirma su nombre de usuario
// (ya viene escrito: el que puso en el login o el último que ingresó en este
// navegador) y el enlace para elegir una contraseña nueva se envía al correo
// asociado a ese usuario. La respuesta es siempre la misma, exista o no.
export default function Olvide() {
  const { state } = useLocation()
  const [nombre, setNombre] = useState(() => state?.usuario || ultimoUsuario())
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errorCampo = errorUsuario(nombre)
  // El error se muestra mientras se escribe
  const verError = (tocado || nombre !== '') && errorCampo

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setTocado(true)
    if (errorCampo) {
      document.getElementById('usuario')?.focus()
      return
    }
    setEnviando(true)
    try {
      const r = await pedirEnlace(nombre.trim())
      setEnviado(r.mensaje)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <FondoLogin />

      <section className="login__panel">
        <form className="login__form" onSubmit={enviar} noValidate>
          <Logo className="login__logo" />

          <h1>{enviado ? 'Revise su correo' : 'Recuperar contraseña'}</h1>
          <p className="login__subtitle">
            {enviado
              ? 'El enlace vence en 24 horas y sirve una sola vez.'
              : 'Enviaremos al correo asociado a su usuario un enlace para elegir una contraseña nueva.'}
          </p>
          <div className="login__bar" aria-hidden="true">
            <span /><span /><span /><span />
          </div>

          {enviado ? (
            <p className="login__ok" role="status">
              {enviado}
            </p>
          ) : (
            <>
              <label htmlFor="usuario">Nombre de usuario</label>
              <div className={`login__field${verError ? ' login__field--error' : ''}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
                <input
                  id="usuario"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  maxLength={254}
                  placeholder="apellido + inicial del nombre"
                  value={nombre}
                  onChange={conFiltro(sinEspaciosMinusculas, setNombre)}
                  onBlur={() => setTocado(true)}
                  autoFocus
                  aria-invalid={Boolean(verError)}
                  aria-describedby={verError ? 'usuario-error' : 'usuario-ayuda'}
                />
              </div>
              {verError ? (
                <p id="usuario-error" className="login__ayuda login__ayuda--error">
                  {errorCampo}
                </p>
              ) : (
                <p id="usuario-ayuda" className="login__ayuda">
                  Su apellido y la primera letra de su nombre. Ejemplo: Juan Pérez → <b>perezj</b>
                </p>
              )}

              {error && (
                <p className="login__error" role="alert">
                  {error}
                </p>
              )}

              <button className="login__submit" type="submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </>
          )}

          <Link className="login__volver" to="/login" replace>
            ← Volver a iniciar sesión
          </Link>
        </form>
      </section>
    </main>
  )
}
```


---

## 7. `frontend/src/components/categorias/Categorias.jsx`

```jsx
import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/categorias'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import './categorias.css'
import Esqueleto from '../comunes/Esqueleto'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import AvisoOk from '../comunes/AvisoOk'
import Interruptor from '../comunes/Interruptor'
import { tiene } from '../../permisos'
import { conFiltro, nombreCosa, primeraMayuscula, useConCambios } from '../../validaciones'

const ordenar = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

function FormularioCategoria({ categoria, onGuardada, onCerrar }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, descripcion })

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre, descripcion }
      const guardada = categoria
        ? await api.editarCategoria(categoria.id, datos)
        : await api.crearCategoria(datos)
      onGuardada(guardada, !categoria)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}>
      <form className="formulario-categoria" onSubmit={guardar}>
        <label htmlFor="cat-nombre">Nombre</label>
        <input
          id="cat-nombre"
          className="entrada"
          value={nombre}
          onChange={conFiltro(nombreCosa, setNombre)}
          placeholder="Ej.: Seguridad"
          maxLength={120}
          autoCapitalize="sentences"
          autoComplete="off"
          enterKeyHint="next"
          autoFocus
          required
        />

        <label htmlFor="cat-descripcion">Descripción</label>
        <textarea
          id="cat-descripcion"
          className="entrada"
          rows={3}
          value={descripcion}
          onChange={conFiltro(primeraMayuscula, setDescripcion)}
          placeholder="Qué tipo de cuestionarios agrupa"
          maxLength={500}
          autoCapitalize="sentences"
        />

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !nombre.trim() || !conCambios}>
            {guardando ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmarBorrado({ categoria, onBorrada, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)

  async function borrar() {
    setError('')
    setBorrando(true)
    try {
      await api.borrarCategoria(categoria.id)
      onBorrada(categoria.id)
    } catch (e) {
      setError(e.message)
      setBorrando(false)
    }
  }

  return (
    <Modal titulo="Eliminar categoría" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Desea eliminar la categoría <b>{categoria.nombre}</b>? Esta acción no se puede deshacer.
      </p>
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton boton--rojo" onClick={borrar} disabled={borrando}>
          {borrando ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  )
}

function Categorias({ usuario }) {
  const [categorias, setCategorias] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nueva' | categoría
  const [borrando, setBorrando] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api
      .obtenerCategorias()
      .then(setCategorias)
      .catch((e) => setErrorCarga(e.message))
  }, [])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!categorias || !texto) return categorias ?? []
    return categorias.filter(
      (c) => normalizar(c.nombre).includes(texto) || normalizar(c.descripcion).includes(texto),
    )
  }, [categorias, busqueda])
  const paginado = usePaginado(visibles)

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 4000)
  }

  // Desactivar una categoría desactiva también todos sus cuestionarios
  async function cambiarEstado(categoria, activa) {
    try {
      const r = await api.cambiarEstadoCategoria(categoria.id, activa)
      setCategorias((lista) => lista.map((c) => (c.id === categoria.id ? r.categoria : c)))
      avisar(
        activa
          ? `La categoría «${categoria.nombre}» fue activada.`
          : `La categoría «${categoria.nombre}» fue desactivada${
              r.cuestionarios_desactivados
                ? ` junto con ${r.cuestionarios_desactivados} cuestionario${r.cuestionarios_desactivados === 1 ? '' : 's'}`
                : ''
            }.`,
      )
    } catch (e) {
      setErrorCarga(e.message)
    }
  }
  const puedeEditar = tiene(usuario, 'core.change_categoria')

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Categorías</h1>
          <p>Agrupan los cuestionarios por tema.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <button type="button" className="boton pagina__accion" onClick={() => setEditando('nueva')}>
          + Nueva categoría
        </button>
      </header>

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre o descripción" etiqueta="Buscar categorías" />

      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : categorias === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {categorias.length === 0 ? (
            <>
              <b>Todavía no hay categorías.</b>
              <span>Cree la primera con «+ Nueva categoría».</span>
            </>
          ) : (
            <span>No hay categorías que coincidan con «{busqueda}».</span>
          )}
        </div>
      ) : (
        <>
          <ul className="categorias-lista">
            {paginado.items.map((c) => (
              <li key={c.id} className={`categoria${c.activa ? '' : ' categoria--apagada'}`}>
                <div className="categoria__texto">
                  <h3>
                    {c.nombre}
                    {!c.activa && <span className="etiqueta">Desactivada</span>}
                  </h3>
                  {c.descripcion && <p>{c.descripcion}</p>}
                  <span className="categoria__uso">
                    {c.cuestionarios === 1 ? '1 cuestionario' : `${c.cuestionarios} cuestionarios`}
                  </span>
                </div>
                <div className="categoria__acciones acciones-iconos">
                  {puedeEditar && (
                    <Interruptor
                      activo={c.activa}
                      onCambiar={(activa) => cambiarEstado(c, activa)}
                      etiqueta={`Categoría ${c.nombre} activa`}
                      textos={['Activa', 'Inactiva']}
                      confirmacion={{
                        titulo: 'Desactivar categoría',
                        mensaje: (
                          <>
                            ¿Desea desactivar la categoría <b>{c.nombre}</b>?
                            {c.cuestionarios > 0 &&
                              ` También se desactivarán sus cuestionarios (${c.cuestionarios}).`}
                          </>
                        ),
                      }}
                    />
                  )}
                  <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(c)} />
                  <BotonIcono icono={Trash2} etiqueta="Eliminar" variante="peligro" onClick={() => setBorrando(c)} />
                </div>
              </li>
            ))}
          </ul>
          <Paginacion {...paginado} />
        </>
      )}

      {editando && (
        <FormularioCategoria
          categoria={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(categoria, esNueva) => {
            setCategorias((lista) =>
              ordenar(esNueva ? [...lista, categoria] : lista.map((c) => (c.id === categoria.id ? categoria : c))),
            )
            setEditando(null)
            avisar(esNueva ? `La categoría «${categoria.nombre}» fue creada.` : 'Los cambios se guardaron correctamente.')
          }}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          categoria={borrando}
          onCerrar={() => setBorrando(null)}
          onBorrada={(id) => {
            setCategorias((lista) => lista.filter((c) => c.id !== id))
            setBorrando(null)
            avisar('La categoría fue eliminada.')
          }}
        />
      )}
    </main>
  )
}

export default Categorias
```


---

## 8. `frontend/src/components/campanas/ElegirCampana.jsx`

```jsx
import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import * as api from '../../api/campanas'
import Logo from '../comunes/Logo'
import { tiene } from '../../permisos'
import { conFiltro, nombreCosa, primeraMayuscula, useConCambios } from '../../validaciones'
import BotonIcono from '../comunes/BotonIcono'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import './campanas.css'

// Crear o editar una campaña (nombre, descripción y si está activa)
function FormularioCampana({ campana, onGuardada, onCerrar }) {
  const [form, setForm] = useState({
    nombre: campana?.nombre ?? '',
    descripcion: campana?.descripcion ?? '',
    activa: campana?.activa ?? true,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const escribir = (campo, filtro) => conFiltro(filtro, (valor) => setForm((f) => ({ ...f, [campo]: valor })))

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    try {
      onGuardada(campana ? await api.editarCampana(campana.id, form) : await api.crearCampana(form))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={campana ? 'Editar campaña' : 'Nueva campaña'} onCerrar={onCerrar}>
      <form className="formulario-modal" onSubmit={guardar}>
        <label>
          Nombre
          <input
            className="entrada"
            value={form.nombre}
            onChange={escribir('nombre', nombreCosa)}
            maxLength={150}
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="next"
            required
            autoFocus
          />
        </label>
        <label>
          Descripción
          <textarea
            className="entrada"
            rows={2}
            value={form.descripcion}
            onChange={escribir('descripcion', primeraMayuscula)}
            maxLength={500}
            autoCapitalize="sentences"
          />
        </label>
        <label className="interruptor">
          <input type="checkbox" checked={form.activa} onChange={cambiar('activa')} />
          <span className="interruptor__pista" aria-hidden="true" />
          Activa
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
          <button type="submit" className="boton" disabled={guardando || !form.nombre.trim() || !conCambios}>
            {guardando ? 'Guardando…' : campana ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const resumen = (c) =>
  `${c.cuestionarios} cuestionario${c.cuestionarios === 1 ? '' : 's'} · ${c.usuarios} usuario${
    c.usuarios === 1 ? '' : 's'
  } · ${c.rutas} ruta${c.rutas === 1 ? '' : 's'}`

// Pantalla que ve quien puede elegir la campaña después de ingresar: elige la
// campaña y recién ahí se abre el menú con todo lo de esa campaña. Acá mismo se
// crean campañas nuevas y se activan o desactivan (ya no hay sección Campañas).
function ElegirCampana({ usuario, onElegida, onSalir }) {
  const [campanas, setCampanas] = useState(null)
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(null)
  const [editando, setEditando] = useState(null) // null | 'nueva' | campaña
  const puedeCrear = tiene(usuario, 'core.add_campana')
  const puedeEditar = tiene(usuario, 'core.change_campana')

  useEffect(() => {
    // Todas las campañas, también las desactivadas (para poder reactivarlas)
    api
      .obtenerCampanas()
      .then(setCampanas)
      .catch((e) => setError(e.message))
  }, [])

  const activas = (campanas ?? []).filter((c) => c.activa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const inactivas = (campanas ?? []).filter((c) => !c.activa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const paginado = usePaginado(activas)

  async function entrar(campana) {
    setError('')
    setEntrando(campana.id)
    try {
      onElegida(await api.elegirCampana(campana.id))
    } catch (e) {
      setError(e.message)
      setEntrando(null)
    }
  }

  function guardada(campana) {
    setCampanas((lista) => {
      const sin = (lista ?? []).filter((c) => c.id !== campana.id)
      const anterior = (lista ?? []).find((c) => c.id === campana.id)
      // Al crear o editar, el servidor no manda los conteos: se conservan los que había
      return [...sin, { cuestionarios: 0, usuarios: 0, rutas: 0, ...anterior, ...campana }]
    })
    setEditando(null)
  }

  return (
    <div className="elegir">
      <svg className="elegir__ola" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0h400v140c-40 6-80-2-110-22C250 92 215 50 160 48 105 46 60 70 0 104Z" />
      </svg>

      <main className="elegir__contenido">
        <Logo className="elegir__logo" />
        <header className="elegir__encabezado">
          <div>
            <h1>Seleccione la campaña</h1>
            <p>
              Bienvenido/a, {usuario.nombre || usuario.email}. Seleccione la campaña en la que va a trabajar: se
              mostrarán solo sus datos.
            </p>
            <span className="franja-corta" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          {puedeCrear && (
            <button type="button" className="boton" onClick={() => setEditando('nueva')}>
              <Plus size={17} aria-hidden="true" />
              Nueva campaña
            </button>
          )}
        </header>

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        {campanas === null ? (
          <p className="vacio-tarjeta">Cargando…</p>
        ) : activas.length === 0 ? (
          <div className="vacio-tarjeta">
            <b>No hay campañas activas.</b>
            <span>{puedeCrear ? 'Cree una campaña para comenzar.' : 'Solicite a la administración que cree una.'}</span>
          </div>
        ) : (
          <>
            <ul className="elegir__lista">
              {paginado.items.map((c) => (
                <li key={c.id} className="elegir__item">
                  <button
                    type="button"
                    className="elegir__campana"
                    onClick={() => entrar(c)}
                    disabled={entrando !== null}
                    aria-busy={entrando === c.id}
                  >
                    <span className="elegir__nombre">{c.nombre}</span>
                    {c.descripcion && <span className="elegir__descripcion">{c.descripcion}</span>}
                    <span className="elegir__datos">
                      <span>{resumen(c)}</span>
                    </span>
                    <span className="elegir__entrar" aria-hidden="true">
                      {entrando === c.id ? 'Ingresando…' : 'Ingresar →'}
                    </span>
                  </button>
                  {puedeEditar && (
                    <BotonIcono
                      icono={Pencil}
                      etiqueta={`Editar ${c.nombre}`}
                      ayuda="Editar o desactivar"
                      className="elegir__editar"
                      onClick={() => setEditando(c)}
                    />
                  )}
                </li>
              ))}
            </ul>
            <Paginacion {...paginado} contenedor="html" />
          </>
        )}

        {inactivas.length > 0 && (
          <section className="elegir__inactivas" aria-labelledby="titulo-inactivas">
            <h2 id="titulo-inactivas">Campañas desactivadas</h2>
            <ul>
              {inactivas.map((c) => (
                <li key={c.id}>
                  <span>
                    <b>{c.nombre}</b>
                    <small>{resumen(c)}</small>
                  </span>
                  {puedeEditar && (
                    <button type="button" className="boton boton--borde boton--chico" onClick={() => setEditando(c)}>
                      Editar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="elegir__pie">
          <button type="button" className="enlace-boton" onClick={onSalir}>
            Cerrar sesión
          </button>
        </footer>
      </main>

      {editando && (
        <FormularioCampana
          campana={editando === 'nueva' ? null : editando}
          onGuardada={guardada}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

export default ElegirCampana
```


---

## 9. `frontend/src/components/equipos/equipos.jsx`

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/equipos'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import './equipos.css'
import Esqueleto from '../comunes/Esqueleto'
import Interruptor from '../comunes/Interruptor'
import { Pencil } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import AvisoOk from '../comunes/AvisoOk'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import { conFiltro, nombreCosa, useConCambios } from '../../validaciones'

function FormularioEquipo({ equipo, rutas, disponibles, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(equipo?.nombre ?? '')
  const [ruta, setRuta] = useState(equipo?.ruta ? String(equipo.ruta) : '')
  const [elegidos, setElegidos] = useState(() => (equipo?.usuarios ?? []).map((u) => u.id))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, ruta, elegidos: [...elegidos].sort((a, b) => a - b) })

  // Los que ya están en este equipo más los que no tienen equipo
  const opciones = [...(equipo?.usuarios ?? []), ...disponibles]

  const alternar = (id) =>
    setElegidos((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]))

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre, ruta: Number(ruta), usuarios: elegidos }
      const guardado = equipo ? await api.editarEquipo(equipo.id, datos) : await api.crearEquipo(datos)
      onGuardado(guardado, !equipo)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={equipo ? 'Editar equipo' : 'Nuevo equipo'} onCerrar={onCerrar}>
      <form className="formulario-equipo" onSubmit={guardar}>
        <label htmlFor="equipo-nombre">Nombre</label>
        <input
          id="equipo-nombre"
          className="entrada"
          value={nombre}
          onChange={conFiltro(nombreCosa, setNombre)}
          placeholder="Ej.: Equipo Norte"
          maxLength={120}
          autoCapitalize="sentences"
          autoComplete="off"
          enterKeyHint="next"
          autoFocus
          required
        />

        <label htmlFor="equipo-ruta">Ruta</label>
        <select
          id="equipo-ruta"
          className="entrada"
          value={ruta}
          onChange={(e) => setRuta(e.target.value)}
          disabled={rutas.length === 0}
          required
        >
          <option value="" disabled>
            Seleccione una ruta
          </option>
          {rutas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        {rutas.length === 0 && (
          <p className="equipo__ayuda">
            Para crear un equipo primero debe existir una ruta en esta campaña. Las rutas se crean desde el Mapa.
          </p>
        )}

        <fieldset className="equipo__usuarios">
          <legend>Usuarios</legend>
          {opciones.length === 0 ? (
            <p className="equipo__ayuda">No hay usuarios disponibles para asignar.</p>
          ) : (
            <>
              <ul className="equipo__usuarios-lista">
                {opciones.map((u) => (
                  <li key={u.id}>
                    <label className="equipo__usuario">
                      <input type="checkbox" checked={elegidos.includes(u.id)} onChange={() => alternar(u.id)} />
                      <span className="equipo__usuario-nombre">{u.nombre}</span>
                      <small>{u.email}</small>
                    </label>
                  </li>
                ))}
              </ul>
              <p className={elegidos.length ? 'equipo__ayuda' : 'equipo__ayuda texto-error'}>
                {elegidos.length === 0
                  ? 'Seleccione al menos un usuario.'
                  : elegidos.length === 1
                    ? '1 usuario seleccionado.'
                    : `${elegidos.length} usuarios seleccionados.`}
              </p>
            </>
          )}
        </fieldset>

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="boton"
            disabled={guardando || !nombre.trim() || !ruta || elegidos.length === 0 || !conCambios}
          >
            {guardando ? 'Guardando…' : equipo ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Equipos({ usuario }) {
  const [equipos, setEquipos] = useState(null)
  const [rutas, setRutas] = useState([])
  const [disponibles, setDisponibles] = useState([]) // usuarios sin equipo
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nuevo' | equipo
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  const puedeCrear = tiene(usuario, 'core.add_equipo')
  const puedeEditar = tiene(usuario, 'core.change_equipo')

  // Trae equipos, rutas y usuarios sin equipo. Se vuelve a llamar al guardar,
  // porque asignar usuarios cambia quiénes quedan disponibles.
  const cargar = useCallback(
    () =>
      api
        .obtenerEquipos()
        .then((r) => {
          setEquipos(r.equipos)
          setRutas(r.rutas)
          setDisponibles(r.usuarios_disponibles)
        })
        .catch((e) => setErrorCarga(e.message)),
    [],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!equipos || !texto) return equipos ?? []
    return equipos.filter(
      (e) =>
        normalizar(e.nombre).includes(texto) ||
        normalizar(e.ruta_nombre).includes(texto) ||
        e.usuarios.some((u) => normalizar(u.nombre).includes(texto)),
    )
  }, [equipos, busqueda])
  const paginado = usePaginado(visibles)

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 3000)
  }

  async function cambiarEstado(equipo) {
    setErrorAccion('')
    try {
      const guardado = await api.editarEquipo(equipo.id, { activo: !equipo.activo })
      setEquipos((lista) => lista.map((x) => (x.id === guardado.id ? guardado : x)))
      avisar(guardado.activo ? `El equipo «${guardado.nombre}» fue activado.` : `El equipo «${guardado.nombre}» fue desactivado.`)
    } catch (e) {
      setErrorAccion(e.message)
    }
  }

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Equipos</h1>
          <p>Equipos de trabajo y la ruta que recorre cada uno.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {puedeCrear && (
          <button type="button" className="boton pagina__accion" onClick={() => setEditando('nuevo')}>
            + Nuevo equipo
          </button>
        )}
      </header>

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, ruta o usuario" etiqueta="Buscar equipos" />

      <AvisoOk>{aviso}</AvisoOk>

      {errorAccion && (
        <p className="texto-error" role="alert">
          {errorAccion}
        </p>
      )}

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : equipos === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {equipos.length === 0 ? (
            <>
              <b>Todavía no hay equipos.</b>
              {puedeCrear && <span>Cree el primero con «+ Nuevo equipo».</span>}
            </>
          ) : (
            <span>No hay equipos que coincidan con «{busqueda}».</span>
          )}
        </div>
      ) : (
        <>
        <ul className="equipos-lista">
          {paginado.items.map((e) => (
            <li key={e.id} className={e.activo ? 'equipo' : 'equipo equipo--inactivo'}>
              <div className="equipo__texto">
                <h3>{e.nombre}</h3>
                <div className="equipo__etiquetas">
                  <span className={e.ruta ? 'equipo__ruta' : 'equipo__ruta equipo__ruta--vacia'}>
                    {e.ruta_nombre ? `Ruta: ${e.ruta_nombre}` : 'Sin ruta'}
                  </span>
                  {!e.activo && <span className="equipo__estado">Desactivado</span>}
                </div>
                <p className="equipo__integrantes">
                  {e.usuarios.length === 0
                    ? 'Sin usuarios asignados'
                    : `${e.usuarios.length === 1 ? 'Usuario' : 'Usuarios'}: ${e.usuarios.map((u) => u.nombre).join(', ')}`}
                </p>
              </div>
              {puedeEditar && (
                <div className="equipo__acciones acciones-iconos">
                  <Interruptor
                    activo={e.activo}
                    onCambiar={() => cambiarEstado(e)}
                    etiqueta={`Equipo ${e.nombre} activo`}
                    confirmacion={{
                      titulo: 'Desactivar equipo',
                      mensaje: (
                        <>
                          ¿Desea desactivar el equipo <b>{e.nombre}</b>?
                        </>
                      ),
                    }}
                  />
                  <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(e)} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <Paginacion {...paginado} />
        </>
      )}

      {editando && (
        <FormularioEquipo
          equipo={editando === 'nuevo' ? null : editando}
          rutas={rutas}
          disponibles={disponibles}
          onCerrar={() => setEditando(null)}
          onGuardado={async (equipo, esNuevo) => {
            setEditando(null)
            await cargar()
            avisar(esNuevo ? `El equipo «${equipo.nombre}» fue creado.` : 'Los cambios se guardaron correctamente.')
          }}
        />
      )}
    </main>
  )
}

export default Equipos
```


---

## 10. `frontend/src/components/grupos/grupos.jsx`

```jsx
import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/grupos'
import Modal from '../comunes/Modal'
import './grupos.css'
import Esqueleto from '../comunes/Esqueleto'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import AvisoOk from '../comunes/AvisoOk'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import { conFiltro, nombreCosa, useConCambios } from '../../validaciones'

const ordenar = (lista) =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const ORDEN_ACCIONES = ['Ver', 'Crear', 'Editar', 'Borrar']
const posicion = (accion) => {
  const i = ORDEN_ACCIONES.indexOf(accion)
  return i === -1 ? ORDEN_ACCIONES.length : i
}

function FormularioGrupo({ grupo, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [seleccion, setSeleccion] = useState(new Set(grupo?.permisos ?? []))
  const [secciones, setSecciones] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, permisos: [...seleccion].sort((a, b) => a - b) })

  useEffect(() => {
    api
      .obtenerPermisos()
      .then(setSecciones)
      .catch((e) => setError(e.message))
  }, [])

  function alternar(id) {
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  function alternarSeccion(seccion) {
    const ids = seccion.permisos.map((p) => p.id)
    const todos = ids.every((id) => seleccion.has(id))
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      ids.forEach((id) => (todos ? nueva.delete(id) : nueva.add(id)))
      return nueva
    })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)

    try {
      const datos = {
        nombre: nombre.trim(),
        permisos: [...seleccion],
      }

      const guardado = grupo
        ? await api.editarGrupo(grupo.id, datos)
        : await api.crearGrupo(datos)

      onGuardado(guardado, !grupo)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={grupo ? 'Editar rol' : 'Nuevo rol'}
      onCerrar={onCerrar}
    >
      <form className="formulario-grupo" onSubmit={guardar}>
        <label htmlFor="grupo-nombre">Nombre del rol</label>

        <input
          id="grupo-nombre"
          className="entrada"
          value={nombre}
          onChange={conFiltro(nombreCosa, setNombre)}
          placeholder="Ej.: Coordinador de zona"
          maxLength={120}
          autoCapitalize="sentences"
          autoComplete="off"
          enterKeyHint="next"
          autoFocus
          required
        />

        <span className="formulario-grupo__titulo">
          Permisos ({seleccion.size})
        </span>

        {secciones === null ? (
          <p className="texto-suave">Cargando permisos…</p>
        ) : (
          <div className="permisos-selector">
            {secciones.map((seccion) => {
              const permisos = [...seccion.permisos].sort(
                (a, b) => posicion(a.accion) - posicion(b.accion),
              )
              const todos = permisos.every((p) => seleccion.has(p.id))

              return (
                <fieldset key={seccion.seccion} className="permisos-selector__seccion">
                  <legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={todos}
                        onChange={() => alternarSeccion(seccion)}
                      />
                      <b>{seccion.seccion}</b>
                    </label>
                  </legend>

                  <div className="permisos-selector__acciones">
                    {permisos.map((permiso) => (
                      <label key={permiso.id}>
                        <input
                          type="checkbox"
                          checked={seleccion.has(permiso.id)}
                          onChange={() => alternar(permiso.id)}
                        />
                        {permiso.accion}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            })}
          </div>
        )}

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        <div className="acciones">
          <button
            type="button"
            className="boton boton--borde"
            onClick={onCerrar}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="boton"
            disabled={guardando || !nombre.trim() || !conCambios}
          >
            {guardando ? 'Guardando…' : grupo ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Eliminar un rol: si tiene usuarios (de cualquier campaña) no se puede, y se avisa
function ConfirmarBorrado({ grupo, onBorrado, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)
  const cantidad = grupo.total_usuarios ?? 0

  async function borrar() {
    setError('')
    setBorrando(true)
    try {
      await api.borrarGrupo(grupo.id)
      onBorrado(grupo.id)
    } catch (e) {
      setError(e.message)
      setBorrando(false)
    }
  }

  if (cantidad > 0)
    return (
      <Modal titulo="No se puede eliminar el rol" onCerrar={onCerrar}>
        <p className="modal__texto">
          El rol <b>{grupo.nombre}</b> tiene {cantidad} usuario{cantidad === 1 ? '' : 's'} asignado
          {cantidad === 1 ? '' : 's'}. Para eliminarlo, asigne otro rol a {cantidad === 1 ? 'ese usuario' : 'esos usuarios'}.
        </p>
        <div className="acciones">
          <button type="button" className="boton" onClick={onCerrar} autoFocus>
            Entendido
          </button>
        </div>
      </Modal>
    )

  return (
    <Modal titulo="Eliminar rol" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Desea eliminar el rol <b>{grupo.nombre}</b>? Esta acción no se puede deshacer.
      </p>
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton boton--rojo" onClick={borrar} disabled={borrando}>
          {borrando ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  )
}

function Grupos() {
  const [grupos, setGrupos] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api
      .obtenerGrupos()
      .then(setGrupos)
      .catch((e) => setErrorCarga(e.message))
  }, [])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)

    if (!grupos || !texto) return grupos ?? []

    // Por nombre del rol o por nombre o correo de sus usuarios, sin distinguir acentos
    return grupos.filter((grupo) =>
      normalizar(`${grupo.nombre} ${grupo.usuarios.map((u) => `${u.nombre} ${u.email}`).join(' ')}`).includes(texto),
    )
  }, [grupos, busqueda])
  const paginado = usePaginado(visibles)

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 3000)
  }

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Roles</h1>
          <p>Los mismos roles que se asignan en Usuarios, con sus permisos e integrantes.</p>

          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>

        <button
          type="button"
          className="boton pagina__accion"
          onClick={() => setEditando('nuevo')}
        >
          + Nuevo rol
        </button>
      </header>

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre o usuario" etiqueta="Buscar roles" />

      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : grupos === null ? (
        <Esqueleto texto="Cargando roles…" />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {grupos.length === 0 ? (
            <>
              <b>Todavía no hay roles.</b>
              <span>Cree el primero con «+ Nuevo rol».</span>
            </>
          ) : (
            <>
              <span>No hay roles que coincidan con «{busqueda}».</span>
              <button type="button" className="enlace-boton" onClick={() => setBusqueda('')}>
                Limpiar búsqueda
              </button>
            </>
          )}
        </div>
      ) : (
        <>
        <ul className="grupos-lista">
          {paginado.items.map((grupo) => (
            <li key={grupo.id} className="grupo">
              <div className="grupo__texto">
                <h3>{grupo.nombre}</h3>

                <p className="grupo__permisos">
                  {grupo.permisos.length === 0
                    ? 'Sin permisos'
                    : `${grupo.permisos.length} permiso${grupo.permisos.length === 1 ? '' : 's'}`}
                </p>

                <p className="grupo__usuarios">
                  {grupo.usuarios.length === 0 ? (
                    'Sin usuarios'
                  ) : (
                    <>
                      {grupo.usuarios.length === 1 ? 'Usuario' : 'Usuarios'} ({grupo.usuarios.length}):{' '}
                      {grupo.usuarios.map((u, i) => (
                        <span key={u.id} className={u.activo ? undefined : 'grupo__usuario--inactivo'}>
                          {i > 0 && ', '}
                          {u.nombre}
                          {!u.activo && ' (inactivo)'}
                        </span>
                      ))}
                    </>
                  )}
                </p>
              </div>

              <div className="grupo__acciones acciones-iconos">
                <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(grupo)} />
                <BotonIcono
                  icono={Trash2}
                  etiqueta="Eliminar rol"
                  variante="peligro"
                  onClick={() => setBorrando(grupo)}
                />
              </div>
            </li>
          ))}
        </ul>
        <Paginacion {...paginado} />
        </>
      )}

      {editando && (
        <FormularioGrupo
          grupo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(grupo, esNuevo) => {
            setGrupos((lista) =>
              ordenar(
                esNuevo
                  ? [...lista, grupo]
                  : lista.map((g) => (g.id === grupo.id ? grupo : g)),
              ),
            )

            setEditando(null)
            avisar(
              esNuevo
                ? `El rol «${grupo.nombre}» fue creado.`
                : 'Los cambios se guardaron correctamente.',
            )
          }}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          grupo={borrando}
          onCerrar={() => setBorrando(null)}
          onBorrado={(id) => {
            setGrupos((lista) =>
              lista.filter((grupo) => grupo.id !== id),
            )
            setBorrando(null)
            avisar('El rol fue eliminado.')
          }}
        />
      )}
    </main>
  )
}

export default Grupos
```


---

## 11. `frontend/src/components/mapa/PanelZonas.jsx`

```jsx
import { useState } from 'react'
import { conFiltro, nombreCosa } from '../../validaciones'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import Confirmacion from '../comunes/Confirmacion'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import * as api from '../../api/mapa'
import { COLORES_ZONA } from './formato'

function SelectorColor({ valor, onCambio }) {
  return (
    <div className="colores" role="radiogroup" aria-label="Color de la zona">
      {COLORES_ZONA.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor === c}
          aria-label={c}
          className="colores__item"
          style={{ background: c }}
          onClick={() => onCambio(c)}
        />
      ))}
    </div>
  )
}

// Rutas que pasan por cada zona (rutas → calles → barrios → zonas)
const rutasDe = (zona, rutas) => rutas.filter((r) => r.zonas.includes(zona.nombre)).map((r) => r.nombre)

function PanelZonas({ zonas, rutas, modo, setModo, seleccionada, onSeleccionar, onGuardada, onBorrada, onError }) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_ZONA[0])
  const [guardando, setGuardando] = useState(false)
  // Valores con los que se abrió la edición: "Guardar" se habilita al cambiar algo
  const [inicial, setInicial] = useState('')
  const paginado = usePaginado(zonas)

  const zonaActiva = zonas.find((z) => z.id === seleccionada)
  const creando = modo?.tipo === 'zona-nueva'
  const editando = modo?.tipo === 'zona-editar'

  function empezarNueva() {
    setNombre('')
    setColor(COLORES_ZONA[zonas.length % COLORES_ZONA.length])
    setModo({ tipo: 'zona-nueva' })
  }

  function empezarEdicion(zona) {
    setNombre(zona.nombre)
    setColor(zona.color)
    setInicial(JSON.stringify([zona.nombre, zona.color, zona.geometria]))
    setModo({ tipo: 'zona-editar', id: zona.id, geometria: zona.geometria })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    onError('')
    try {
      const datos = { nombre, color, geometria: modo.geometria }
      if (creando) {
        onGuardada(await api.crearZona(datos), true)
      } else {
        onGuardada(await api.editarZona(modo.id, datos), false)
      }
      setModo(null)
    } catch (e) {
      onError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  // Zona que se está por borrar (abre la ventana de confirmación)
  const [aBorrar, setABorrar] = useState(null)

  async function borrar(zona) {
    setABorrar(null)
    try {
      await api.borrarZona(zona.id)
      onBorrada(zona.id)
    } catch (e) {
      onError(e.message)
    }
  }

  if (creando || editando) {
    const hayContorno = !!modo.geometria
    const conCambios = creando || JSON.stringify([nombre.trim(), color, modo.geometria]) !== inicial
    return (
      <form className="formulario" onSubmit={guardar}>
        <h2>{creando ? 'Nueva zona' : 'Editar zona'}</h2>
        {creando && hayContorno && (
          <p className="paso paso--listo">
            Contorno dibujado.{' '}
            <button type="button" className="enlace-boton" onClick={() => setModo({ tipo: 'zona-nueva' })}>
              Volver a dibujar
            </button>
          </p>
        )}
        {editando && <p className="paso">Arrastre los vértices en el mapa para cambiar el contorno.</p>}

        <label htmlFor="zona-nombre">Nombre</label>
        <input
          id="zona-nombre"
          className="entrada"
          value={nombre}
          onChange={conFiltro(nombreCosa, setNombre)}
          placeholder="Ej.: Zona Norte"
          maxLength={100}
          autoCapitalize="sentences"
          autoComplete="off"
          enterKeyHint="done"
          required
        />

        <span className="etiqueta">Color</span>
        <SelectorColor valor={color} onCambio={setColor} />

        <p className="texto-suave">Los barrios cuyo centro quede dentro del contorno se asignan a la zona.</p>

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={() => setModo(null)}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !hayContorno || !nombre.trim() || !conCambios}>
            {guardando ? 'Guardando…' : 'Guardar zona'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="listado">
      <button type="button" className="boton boton--ancho" onClick={empezarNueva}>
        + Nueva zona
      </button>

      {zonas.length === 0 ? (
        <p className="vacio">Todavía no hay zonas. Cree la primera dibujándola sobre el mapa.</p>
      ) : (
        <>
        <ul className="items">
          {paginado.items.map((z) => (
            <li key={z.id}>
              <button
                type="button"
                className="item"
                aria-pressed={z.id === seleccionada}
                onClick={() => onSeleccionar(z)}
              >
                <span className="item__color" style={{ background: z.color }} />
                <span className="item__texto">
                  <b>{z.nombre}</b>
                  <small>
                    {z.barrios.length === 1 ? '1 barrio' : `${z.barrios.length} barrios`} ·{' '}
                    {rutasDe(z, rutas).length === 1 ? '1 ruta' : `${rutasDe(z, rutas).length} rutas`}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Paginacion {...paginado} contenedor=".mapa__lateral" />
        </>
      )}

      {zonaActiva && (
        <section className="detalle">
          <h3>{zonaActiva.nombre}</h3>
          <p className="texto-suave">
            {zonaActiva.barrios.length === 0
              ? 'No tiene barrios dentro.'
              : zonaActiva.barrios
                  .slice(0, 15)
                  .map((b) => b.nombre)
                  .join(', ') + (zonaActiva.barrios.length > 15 ? ` y ${zonaActiva.barrios.length - 15} más.` : '.')}
          </p>
          <dl className="datos">
            <dt>Rutas</dt>
            <dd>{rutasDe(zonaActiva, rutas).join(', ') || 'Ninguna ruta pasa por esta zona'}</dd>
          </dl>
          <div className="acciones acciones-iconos">
            <BotonIcono icono={Pencil} etiqueta="Editar zona" onClick={() => empezarEdicion(zonaActiva)} />
            <BotonIcono icono={Trash2} etiqueta="Eliminar zona" variante="peligro" onClick={() => setABorrar(zonaActiva)} />
          </div>
          {aBorrar && (
            <Confirmacion
              titulo="Eliminar zona"
              textoConfirmar="Eliminar"
              onCerrar={() => setABorrar(null)}
              onConfirmar={() => borrar(aBorrar)}
            >
              ¿Desea eliminar la zona <b>{aBorrar.nombre}</b>? Sus barrios quedarán sin zona.
            </Confirmacion>
          )}
        </section>
      )}
    </div>
  )
}

export default PanelZonas
```


---

## 12. `frontend/src/components/mapa/PanelRutas.jsx`

```jsx
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import Confirmacion from '../comunes/Confirmacion'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import * as api from '../../api/mapa'
import { conFiltro, nombreCosa, primeraMayuscula, useConCambios } from '../../validaciones'
import { PERFILES, distancia, duracion } from './formato'

// Agrupa las rutas por zona (rutas → calles → barrios → zonas). Una ruta que
// pasa por dos zonas aparece en las dos; las que no pasan por ninguna, al final.
function porZona(rutas) {
  const grupos = new Map()
  for (const r of rutas) {
    for (const zona of r.zonas.length ? r.zonas : [null]) {
      if (!grupos.has(zona)) grupos.set(zona, [])
      grupos.get(zona).push(r)
    }
  }
  return [...grupos].sort(([a], [b]) => (a === null) - (b === null) || String(a).localeCompare(String(b)))
}

function FormularioRuta({ modo, setModo, form, cambiar, escribir, guardando, onGuardar }) {
  const conCambios = useConCambios({ ...form, paradas: modo.paradas })
  const quitar = (i) => setModo((m) => ({ ...m, paradas: m.paradas.filter((_, j) => j !== i) }))
  const faltan = Math.max(0, 2 - modo.paradas.length)
  return (
    <form className="formulario" onSubmit={onGuardar}>
      <h2>{modo.id ? 'Editar ruta' : 'Nueva ruta'}</h2>
      <p className="paso">Marque en el mapa los puntos por donde pasa la ruta, en orden.</p>

      {modo.paradas.length > 0 && (
        <ol className="paradas">
          {modo.paradas.map(([lng, lat], i) => (
            <li key={`${i}-${lng}-${lat}`}>
              <span className="paradas__numero">{i + 1}</span>
              <span className="paradas__coord">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
              <button type="button" className="enlace-boton" onClick={() => quitar(i)} aria-label={`Quitar punto ${i + 1}`}>
                Quitar
              </button>
            </li>
          ))}
        </ol>
      )}
      {faltan > 0 && (
        <p className="texto-suave">{faltan === 2 ? 'Faltan al menos 2 puntos.' : 'Falta al menos 1 punto.'}</p>
      )}

      <label htmlFor="ruta-nombre">Nombre</label>
      <input
        id="ruta-nombre"
        className="entrada"
        value={form.nombre}
        onChange={escribir('nombre', nombreCosa)}
        placeholder="Ej.: Recorrido del sábado"
        maxLength={120}
        autoCapitalize="sentences"
        autoComplete="off"
        enterKeyHint="next"
        required
      />

      <label htmlFor="ruta-perfil">Cómo se recorre</label>
      <select id="ruta-perfil" className="entrada" value={form.perfil} onChange={cambiar('perfil')}>
        {PERFILES.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>

      <label htmlFor="ruta-descripcion">Notas</label>
      <textarea
        id="ruta-descripcion"
        className="entrada"
        rows={2}
        maxLength={500}
        autoCapitalize="sentences"
        value={form.descripcion}
        onChange={escribir('descripcion', primeraMayuscula)}
      />

      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={() => setModo(null)}>
          Cancelar
        </button>
        <button type="submit" className="boton" disabled={guardando || faltan > 0 || !form.nombre.trim() || !conCambios}>
          {guardando ? 'Calculando…' : 'Calcular y guardar'}
        </button>
      </div>
    </form>
  )
}

function PanelRutas({ rutas, modo, setModo, seleccionada, onSeleccionar, onGuardada, onBorrada, onError }) {
  const [form, setForm] = useState({ nombre: '', perfil: 'foot-walking', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  const rutaActiva = rutas.find((r) => r.id === seleccionada)
  const marcando = modo?.tipo === 'ruta'
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const escribir = (campo, filtro) => conFiltro(filtro, (valor) => setForm((f) => ({ ...f, [campo]: valor })))

  function empezar(ruta) {
    setForm({
      nombre: ruta?.nombre ?? '',
      perfil: ruta?.perfil ?? 'foot-walking',
      descripcion: ruta?.descripcion ?? '',
    })
    setModo({ tipo: 'ruta', id: ruta?.id, paradas: ruta?.paradas ?? [] })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setGuardando(true)
    onError('')
    const datos = { ...form, paradas: modo.paradas }
    try {
      const ruta = modo.id ? await api.editarRuta(modo.id, datos) : await api.crearRuta(datos)
      onGuardada(ruta, !modo.id)
      setModo(null)
    } catch (e) {
      onError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  // Ruta que se está por borrar (abre la ventana de confirmación)
  const [aBorrar, setABorrar] = useState(null)

  async function borrar(ruta) {
    setABorrar(null)
    try {
      await api.borrarRuta(ruta.id)
      onBorrada(ruta.id)
    } catch (e) {
      onError(e.message)
    }
  }

  const paginado = usePaginado(rutas)

  if (marcando)
    return (
      <FormularioRuta
        modo={modo}
        setModo={setModo}
        form={form}
        cambiar={cambiar}
        escribir={escribir}
        guardando={guardando}
        onGuardar={guardar}
      />
    )

  return (
    <div className="listado">
      <button type="button" className="boton boton--ancho" onClick={() => empezar(null)}>
        + Nueva ruta
      </button>

      {rutas.length === 0 ? (
        <p className="vacio">Todavía no hay rutas. Cree una marcando los puntos sobre el mapa.</p>
      ) : (
        <>
          {porZona(paginado.items).map(([zona, lista]) => (
            <section key={zona ?? 'sin-zona'} className="grupo-zona">
              <h3 className="grupo-zona__titulo">{zona ? `Zona ${zona}` : 'Sin zona'}</h3>
              <ul className="items">
                {lista.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="item"
                      aria-pressed={r.id === seleccionada}
                      onClick={() => onSeleccionar(r)}
                    >
                      <span className="item__color item__color--ruta" />
                      <span className="item__texto">
                        <b>{r.nombre}</b>
                        <small>
                          {distancia(r.distancia_m)} · {duracion(r.duracion_s)} ·{' '}
                          {PERFILES.find(([v]) => v === r.perfil)?.[1].toLowerCase()}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Paginacion {...paginado} contenedor=".mapa__lateral" />
        </>
      )}

      {rutaActiva && (
        <section className="detalle">
          <h3>{rutaActiva.nombre}</h3>
          <dl className="datos">
            <dt>Distancia</dt>
            <dd>{distancia(rutaActiva.distancia_m)}</dd>
            <dt>Tiempo estimado</dt>
            <dd>{duracion(rutaActiva.duracion_s)}</dd>
            {/* Zonas y calles salen de consultas: rutas → calles → barrios → zonas */}
            <dt>{rutaActiva.zonas.length === 1 ? 'Zona' : 'Zonas'}</dt>
            <dd>{rutaActiva.zonas.length ? rutaActiva.zonas.join(', ') : 'Sin zona'}</dd>
            <dt>Calles</dt>
            <dd>{rutaActiva.calles}</dd>
            <dt>Puntos</dt>
            <dd>{rutaActiva.paradas.length}</dd>
            {rutaActiva.equipos.length > 0 && (
              <>
                <dt>Equipos</dt>
                <dd>{rutaActiva.equipos.join(', ')}</dd>
              </>
            )}
          </dl>
          {rutaActiva.descripcion && <p className="texto-suave">{rutaActiva.descripcion}</p>}
          <div className="acciones acciones-iconos">
            <BotonIcono icono={Pencil} etiqueta="Editar ruta" onClick={() => empezar(rutaActiva)} />
            <BotonIcono icono={Trash2} etiqueta="Eliminar ruta" variante="peligro" onClick={() => setABorrar(rutaActiva)} />
          </div>
          {aBorrar && (
            <Confirmacion
              titulo="Eliminar ruta"
              textoConfirmar="Eliminar"
              onCerrar={() => setABorrar(null)}
              onConfirmar={() => borrar(aBorrar)}
            >
              ¿Desea eliminar la ruta <b>{aBorrar.nombre}</b>?
            </Confirmacion>
          )}
        </section>
      )}
    </div>
  )
}

export default PanelRutas
```


---

## 13. `frontend/src/components/cuestionarios/EditorCuestionario.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import { conFiltro, primeraMayuscula, textoLibre } from '../../validaciones'
import { Link, useNavigate, useParams } from 'react-router'
import { obtenerCategorias } from '../../api/categorias'
import * as api from '../../api/cuestionarios'
import './cuestionarios.css'
import { variableDe } from './variable'

// Editor de cuestionarios al estilo Google Forms: una tarjeta para el título
// y una tarjeta por pregunta, con sus opciones.

// Máximo de preguntas por cuestionario (el backend controla lo mismo)
const MAX_PREGUNTAS = 15

let siguienteClave = 1
const clave = () => `c${siguienteClave++}`

const nuevaOpcion = (texto = '') => ({ clave: clave(), texto })
const nuevaPregunta = () => ({
  clave: clave(),
  enunciado: '',
  tipo: 'una_opcion',
  obligatoria: false,
  // Vacías: "Opción 1", "Opción 2"... se ven como placeholder
  opciones: [nuevaOpcion(), nuevaOpcion()],
})

function desdeServidor(c) {
  return {
    titulo: c.titulo,
    descripcion: c.descripcion,
    categoria: c.categoria,
    activo: c.activo,
    preguntas: c.preguntas.map((p) => ({
      clave: clave(),
      enunciado: p.enunciado,
      tipo: 'una_opcion',
      obligatoria: p.obligatoria,
      opciones: p.opciones.map((o) => nuevaOpcion(o.texto)),
    })),
  }
}

function paraServidor(f) {
  return {
    titulo: f.titulo,
    descripcion: f.descripcion,
    categoria: f.categoria ? Number(f.categoria) : null,
    activo: f.activo,
    preguntas: f.preguntas.map((p) => ({
      enunciado: p.enunciado,
      tipo: p.tipo,
      obligatoria: p.obligatoria,
      opciones: p.opciones.map((o) => ({ texto: o.texto })),
    })),
  }
}

function Icono({ d }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const ICONOS = {
  subir: 'M12 19V5M5 12l7-7 7 7',
  bajar: 'M12 5v14M19 12l-7 7-7-7',
  duplicar: 'M8 8h11v11H8zM5 16V5h11',
  borrar: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  quitar: 'M6 6l12 12M18 6 6 18',
}

function TarjetaPregunta({ pregunta, numero, total, activa, bloqueado, onActivar, onCambio, onMover, onDuplicar, onBorrar }) {
  const refsOpciones = useRef({})
  const [enfocar, setEnfocar] = useState(null)

  useEffect(() => {
    if (enfocar && refsOpciones.current[enfocar]) {
      refsOpciones.current[enfocar].focus()
      refsOpciones.current[enfocar].select()
      setEnfocar(null)
    }
  }, [enfocar, pregunta.opciones])

  const cambiar = (campos) => onCambio({ ...pregunta, ...campos })
  const cambiarOpcion = (c, texto) =>
    cambiar({ opciones: pregunta.opciones.map((o) => (o.clave === c ? { ...o, texto } : o)) })
  const quitarOpcion = (c) => cambiar({ opciones: pregunta.opciones.filter((o) => o.clave !== c) })
  function agregarOpcion(despuesDe) {
    const opcion = nuevaOpcion()
    const i = despuesDe ? pregunta.opciones.findIndex((o) => o.clave === despuesDe) + 1 : pregunta.opciones.length
    cambiar({ opciones: [...pregunta.opciones.slice(0, i), opcion, ...pregunta.opciones.slice(i)] })
    setEnfocar(opcion.clave)
  }

  return (
    <section
      className={`tarjeta-form tarjeta-pregunta${activa ? ' tarjeta-form--activa' : ''}`}
      onFocus={onActivar}
      onClick={onActivar}
      aria-label={`Pregunta ${numero}`}
    >
      {/* Arriba de la pregunta: qué tipo de variable es (se deduce de las opciones) */}
      <span className={`variable variable--${variableDe(pregunta.opciones)} tarjeta-pregunta__variable`}>
        {variableDe(pregunta.opciones) === 'cuantitativa' ? 'Cuantitativa' : 'Cualitativa'}
      </span>
      <div className="tarjeta-pregunta__cabecera">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <textarea
          className="campo-linea campo-linea--pregunta"
          rows={1}
          value={pregunta.enunciado}
          onChange={conFiltro(textoLibre, (enunciado) => cambiar({ enunciado }))}
          placeholder="Escriba la pregunta"
          aria-label={`Texto de la pregunta ${numero}`}
          autoCapitalize="sentences"
          disabled={bloqueado}
        />
      </div>

      <ul className="opciones">
        {pregunta.opciones.map((o, i) => (
          <li key={o.clave} className="opcion">
            <span className="opcion__circulo" aria-hidden="true" />
            <input
              ref={(el) => (refsOpciones.current[o.clave] = el)}
              className="campo-linea"
              value={o.texto}
              onChange={conFiltro(textoLibre, (texto) => cambiarOpcion(o.clave, texto))}
              placeholder={`Opción ${i + 1}`}
              autoCapitalize="sentences"
              autoComplete="off"
              enterKeyHint="next"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  agregarOpcion(o.clave)
                }
              }}
              aria-label={`Opción ${i + 1} de la pregunta ${numero}`}
              disabled={bloqueado}
            />
            {!bloqueado && pregunta.opciones.length > 2 && (
              <button
                type="button"
                className="boton-icono"
                onClick={() => quitarOpcion(o.clave)}
                aria-label={`Quitar opción ${i + 1}`}
                title="Quitar opción"
              >
                <Icono d={ICONOS.quitar} />
              </button>
            )}
          </li>
        ))}
        {!bloqueado && (
          <li className="opcion">
            <span className="opcion__circulo" aria-hidden="true" />
            <button type="button" className="opcion__agregar" onClick={() => agregarOpcion()}>
              Agregar opción
            </button>
          </li>
        )}
      </ul>

      <footer className="tarjeta-pregunta__pie">
        <label className="interruptor">
          <input
            type="checkbox"
            checked={pregunta.obligatoria}
            onChange={(e) => cambiar({ obligatoria: e.target.checked })}
            disabled={bloqueado}
          />
          <span className="interruptor__pista" aria-hidden="true" />
          Obligatoria
        </label>
        {!bloqueado && (
          <div className="tarjeta-pregunta__herramientas">
            <button type="button" className="boton-icono" onClick={() => onMover(-1)} disabled={numero === 1} aria-label="Subir pregunta" title="Subir">
              <Icono d={ICONOS.subir} />
            </button>
            <button type="button" className="boton-icono" onClick={() => onMover(1)} disabled={numero === total} aria-label="Bajar pregunta" title="Bajar">
              <Icono d={ICONOS.bajar} />
            </button>
            <button type="button" className="boton-icono" onClick={onDuplicar} aria-label="Duplicar pregunta" title="Duplicar">
              <Icono d={ICONOS.duplicar} />
            </button>
            <button type="button" className="boton-icono boton-icono--peligro" onClick={onBorrar} disabled={total === 1} aria-label="Eliminar pregunta" title="Eliminar">
              <Icono d={ICONOS.borrar} />
            </button>
          </div>
        )}
      </footer>
    </section>
  )
}

function EditorCuestionario() {
  const { id } = useParams()
  const esNuevo = !id
  const navegar = useNavigate()

  const [form, setForm] = useState(
    esNuevo ? { titulo: '', descripcion: '', categoria: '', activo: true, preguntas: [nuevaPregunta()] } : null,
  )
  const [bloqueado, setBloqueado] = useState(false)
  const [categorias, setCategorias] = useState(null)
  const [activa, setActiva] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Lo que se cargó del servidor (o el formulario vacío): "Guardar" se habilita
  // solo cuando el formulario es distinto de esto
  const [original, setOriginal] = useState(() =>
    esNuevo ? JSON.stringify(paraServidor({ titulo: '', descripcion: '', categoria: '', activo: true, preguntas: [nuevaPregunta()] })) : null,
  )
  const refsPreguntas = useRef({})

  useEffect(() => {
    obtenerCategorias()
      .then(setCategorias)
      .catch((e) => setError(e.message))
    if (!esNuevo) {
      api
        .obtenerCuestionario(id)
        .then((c) => {
          const cargado = desdeServidor(c)
          setForm(cargado)
          setOriginal(JSON.stringify(paraServidor(cargado)))
          setBloqueado(c.bloqueado)
        })
        .catch((e) => setError(e.message))
    }
  }, [id, esNuevo])

  const sinGuardar = Boolean(form && original !== null && JSON.stringify(paraServidor(form)) !== original)

  // Avisa antes de cerrar la pestaña si hay cambios sin guardar
  useEffect(() => {
    if (!sinGuardar) return
    const avisar = (e) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sinGuardar])

  function actualizar(cambios) {
    setForm((f) => ({ ...f, ...cambios }))
  }

  const cambiarPregunta = (p) => actualizar({ preguntas: form.preguntas.map((x) => (x.clave === p.clave ? p : x)) })

  function insertarPregunta(pregunta, despuesDe) {
    if (form.preguntas.length >= MAX_PREGUNTAS) return
    const i = despuesDe ? form.preguntas.findIndex((p) => p.clave === despuesDe) + 1 : form.preguntas.length
    actualizar({ preguntas: [...form.preguntas.slice(0, i), pregunta, ...form.preguntas.slice(i)] })
    setActiva(pregunta.clave)
    // Lleva la vista y el foco a la pregunta nueva
    setTimeout(() => {
      const tarjeta = refsPreguntas.current[pregunta.clave]
      tarjeta?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      tarjeta?.querySelector('textarea')?.focus({ preventScroll: true })
    }, 0)
  }

  function mover(c, paso) {
    const lista = [...form.preguntas]
    const i = lista.findIndex((p) => p.clave === c)
    ;[lista[i], lista[i + paso]] = [lista[i + paso], lista[i]]
    actualizar({ preguntas: lista })
  }

  function duplicar(p) {
    insertarPregunta({ ...p, clave: clave(), opciones: p.opciones.map((o) => nuevaOpcion(o.texto)) }, p.clave)
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const datos = paraServidor(form)
      const guardado = esNuevo ? await api.crearCuestionario(datos) : await api.guardarCuestionario(id, datos)
      setOriginal(JSON.stringify(datos))
      navegar('/cuestionarios', {
        state: {
          aviso: esNuevo ? `El cuestionario «${guardado.titulo}» fue creado.` : 'Los cambios se guardaron correctamente.',
        },
      })
    } catch (e) {
      setError(e.message)
      setGuardando(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.querySelector('.editor')?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Una categoría desactivada solo admite cuestionarios inactivos
  const categoriaElegida = categorias?.find((c) => String(c.id) === String(form?.categoria))
  const categoriaInactiva = Boolean(categoriaElegida && !categoriaElegida.activa)

  if (!form) {
    return <main className="editor">{error ? <p className="texto-error">{error}</p> : <p className="vacio-tarjeta">Cargando…</p>}</main>
  }

  return (
    <form className="editor" onSubmit={guardar}>
      <div className="editor__barra">
        <Link to="/cuestionarios" className="enlace-volver">
          ← Cuestionarios
        </Link>
        <span className="editor__estado">{sinGuardar ? 'Cambios sin guardar' : ''}</span>
        <button type="submit" className="boton" disabled={guardando || !sinGuardar}>
          {guardando ? 'Guardando…' : esNuevo ? 'Crear cuestionario' : 'Guardar cambios'}
        </button>
      </div>

      <div className="editor__columna">
        {error && (
          <p className="aviso-error" role="alert">
            {error}
          </p>
        )}

        <section className="tarjeta-form tarjeta-titulo">
          <input
            className="campo-linea campo-linea--titulo"
            value={form.titulo}
            onChange={conFiltro(textoLibre, (titulo) => actualizar({ titulo }))}
            placeholder="Título del cuestionario"
            aria-label="Título del cuestionario"
            maxLength={180}
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="next"
            required
          />
          <textarea
            className="campo-linea"
            rows={2}
            value={form.descripcion}
            onChange={conFiltro(primeraMayuscula, (descripcion) => actualizar({ descripcion }))}
            placeholder="Descripción"
            aria-label="Descripción"
            maxLength={1000}
            autoCapitalize="sentences"
          />
          <div className="tarjeta-titulo__ajustes">
            <label className="tarjeta-titulo__campo">
              Categoría
              <select
                className="entrada"
                value={form.categoria}
                onChange={(e) => {
                  const elegida = categorias?.find((c) => String(c.id) === e.target.value)
                  // En una categoría desactivada el cuestionario queda inactivo
                  actualizar({ categoria: e.target.value, ...(elegida && !elegida.activa && { activo: false }) })
                }}
                required
              >
                <option value="">Seleccione una categoría</option>
                {categorias
                  ?.filter((c) => c.activa || String(c.id) === String(form.categoria))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {!c.activa && ' (desactivada)'}
                    </option>
                  ))}
              </select>
            </label>
            <label className="interruptor">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => actualizar({ activo: e.target.checked })}
                disabled={categoriaInactiva}
              />
              <span className="interruptor__pista" aria-hidden="true" />
              Activo
            </label>
          </div>
          {categoriaInactiva && (
            <p className="texto-suave">La categoría está desactivada: el cuestionario debe quedar inactivo.</p>
          )}
          {categorias?.length === 0 && (
            <p className="texto-suave">
              Todavía no hay categorías. <Link to="/categorias">Cree una en Categorías</Link>.
            </p>
          )}
        </section>

        {form.preguntas.map((p, i) => (
          <div key={p.clave} ref={(el) => (refsPreguntas.current[p.clave] = el)}>
            <TarjetaPregunta
              pregunta={p}
              numero={i + 1}
              total={form.preguntas.length}
              activa={activa === p.clave}
              bloqueado={bloqueado}
              onActivar={() => setActiva(p.clave)}
              onCambio={cambiarPregunta}
              onMover={(paso) => mover(p.clave, paso)}
              onDuplicar={() => duplicar(p)}
              onBorrar={() => actualizar({ preguntas: form.preguntas.filter((x) => x.clave !== p.clave) })}
            />
          </div>
        ))}

        {!bloqueado &&
          (form.preguntas.length < MAX_PREGUNTAS ? (
            <button
              type="button"
              className="agregar-pregunta"
              onClick={() => insertarPregunta(nuevaPregunta(), activa)}
            >
              + Agregar pregunta ({form.preguntas.length} de {MAX_PREGUNTAS})
            </button>
          ) : (
            <p className="aviso-info">Se alcanzó el máximo de {MAX_PREGUNTAS} preguntas por cuestionario.</p>
          ))}
      </div>
    </form>
  )
}

export default EditorCuestionario
```
