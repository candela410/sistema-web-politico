import { useEffect, useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { obtenerPermisos } from '../../api/usuarios'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import './permisos.css'

// Permisos de Django, solo para consultar. Al entrar se ven todos los permisos
// del sistema; con el filtro se elige un rol y se marca qué puede hacer en
// cada sección. Los permisos se cambian en Gestión → Roles.
const ACCIONES = [
  { clave: 'Ver', texto: 'Ver' },
  { clave: 'Crear', texto: 'Crear' },
  { clave: 'Editar', texto: 'Editar' },
  { clave: 'Borrar', texto: 'Eliminar' },
]
const CLAVES = ACCIONES.map((a) => a.clave)

// Acciones que no son ver/crear/editar/borrar (por ejemplo "Recibir aviso de ...")
const otras = (acciones = []) => acciones.filter((a) => !CLAVES.includes(a))

function Permisos() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState(null)

  useEffect(() => {
    obtenerPermisos()
      .then((d) => {
        setDatos(d)
      })
      .catch((e) => setError(e.message))
  }, [])

  // Antes de los return de error y carga: los hooks no pueden ir después
  const paginado = usePaginado(datos?.usuarios ?? [])

  if (error)
    return (
      <main className="pagina">
        <p className="texto-error">{error}</p>
      </main>
    )
  if (!datos)
    return (
      <main className="pagina">
        <p className="vacio-tarjeta">Cargando…</p>
      </main>
    )

  const rol = datos.grupos.find((g) => g.id === elegido)
  const secciones = datos.todos ?? []

  // Acciones del rol elegido en una sección
  const delRol = (seccion) => rol?.permisos.find((p) => p.seccion === seccion)?.acciones ?? []
  // Roles que tienen algún permiso en una sección (columna de la vista sin filtro)
  const rolesDe = (seccion) => datos.grupos.filter((g) => g.permisos.some((p) => p.seccion === seccion))

  const hayOtras = secciones.some((s) => otras(s.acciones).length > 0)

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Permisos</h1>
          <p>Todos los permisos del sistema. Filtre por rol para ver qué puede hacer cada uno.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      <div className="permisos__filtro">
        <label className="permisos__elegir">
          Filtrar por rol
          <select
            className="entrada"
            value={elegido ?? ''}
            onChange={(e) => setElegido(e.target.value === '' ? null : Number(e.target.value))}
            disabled={datos.grupos.length === 0}
          >
            <option value="">Todos los permisos (sin filtro)</option>
            {datos.grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre} ({g.usuarios} usuario{g.usuarios === 1 ? '' : 's'})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="boton boton--borde"
          onClick={() => setElegido(null)}
          disabled={elegido === null}
        >
          <X size={16} aria-hidden="true" />
          Limpiar filtro
        </button>
      </div>

      <section className="permisos__rol">
        <h2 className="permisos__rol-titulo">
          {rol ? (
            <>
              Permisos del rol {rol.nombre}{' '}
              <span className="texto-suave">
                ({rol.usuarios} usuario{rol.usuarios === 1 ? '' : 's'})
              </span>
            </>
          ) : (
            'Todos los permisos del sistema'
          )}
        </h2>

        {rol && rol.permisos.length === 0 && (
          <p className="vacio-tarjeta">El rol {rol.nombre} no tiene permisos asignados.</p>
        )}

        {secciones.length === 0 ? (
          <p className="vacio-tarjeta">No hay permisos cargados.</p>
        ) : (
          <div className="tabla-envoltura-ancha">
            <table className="matriz">
              <caption className="sr-solo">
                {rol ? `Permisos del rol ${rol.nombre}` : 'Todos los permisos del sistema'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Sección</th>
                  {ACCIONES.map((a) => (
                    <th key={a.clave} scope="col" className="matriz__columna">
                      {a.texto}
                    </th>
                  ))}
                  {hayOtras && <th scope="col">Otros</th>}
                  {!rol && <th scope="col">Roles con algún permiso</th>}
                </tr>
              </thead>
              <tbody>
                {secciones.map((s) => {
                  // Sin filtro: lo que existe en el sistema. Con rol: lo que tiene ese rol.
                  const tiene = rol ? delRol(s.seccion) : s.acciones
                  const extras = otras(tiene)
                  const roles = rol ? [] : rolesDe(s.seccion)
                  return (
                    <tr key={s.seccion}>
                      <th scope="row">{s.seccion}</th>
                      {ACCIONES.map((a) => (
                        <td key={a.clave} className="matriz__columna">
                          {tiene.includes(a.clave) ? (
                            <Check size={18} className="matriz__si" aria-label="Sí" />
                          ) : (
                            <Minus size={16} className="matriz__nada" aria-label="No" />
                          )}
                        </td>
                      ))}
                      {hayOtras && (
                        <td>
                          {extras.length ? (
                            <span className="matriz__acciones">
                              {extras.map((x) => (
                                <span key={x} className="etiqueta">
                                  {x}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <Minus size={16} className="matriz__nada" aria-label="Ninguno" />
                          )}
                        </td>
                      )}
                      {!rol && (
                        <td>
                          {roles.length ? (
                            <span className="matriz__acciones">
                              {roles.map((g) => (
                                <button
                                  key={g.id}
                                  type="button"
                                  className="etiqueta etiqueta--magenta permisos__rol-boton"
                                  onClick={() => setElegido(g.id)}
                                  title={`Ver los permisos del rol ${g.nombre}`}
                                >
                                  {g.nombre}
                                </button>
                              ))}
                            </span>
                          ) : (
                            <span className="texto-suave">Ningún rol</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <h2 className="permisos__titulo">Usuarios de la campaña</h2>
      {datos.usuarios.length === 0 ? (
        <p className="vacio-tarjeta">No hay usuarios activos en esta campaña.</p>
      ) : (
        <>
          <ul className="permisos__usuarios">
            {paginado.items.map((u) => (
              <li key={u.id}>
                <b>{u.nombre}</b>
                <span className="texto-suave">{u.email}</span>
                <span className="permisos__grupos">
                  {u.superusuario && <span className="etiqueta etiqueta--violeta">Superusuario</span>}
                  {u.grupos.map((g) => (
                    <span key={g} className="etiqueta etiqueta--magenta">
                      {g}
                    </span>
                  ))}
                  {!u.superusuario && !u.grupos.length && <span className="etiqueta">Sin rol</span>}
                </span>
              </li>
            ))}
          </ul>
          <Paginacion {...paginado} />
        </>
      )}
    </main>
  )
}

export default Permisos
