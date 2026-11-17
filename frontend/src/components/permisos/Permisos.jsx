import { useEffect, useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { obtenerPermisos } from '../../api/usuarios'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import './permisos.css'

// Permisos de Django por rol, solo para consultar: se ven todos los roles o se
// filtra uno para ver qué puede hacer en cada sección. Los permisos se cambian en Gestión → Roles.
const ACCIONES = [
  { clave: 'Ver', texto: 'Ver' },
  { clave: 'Crear', texto: 'Crear' },
  { clave: 'Editar', texto: 'Editar' },
  { clave: 'Borrar', texto: 'Eliminar' },
]

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

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Permisos</h1>
          <p>Qué puede hacer cada rol en cada sección del sistema.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      {datos.grupos.length === 0 ? (
        <p className="vacio-tarjeta">Todavía no hay roles.</p>
      ) : (
        <>
          <div className="permisos__filtro">
            <label className="permisos__elegir">
              Rol
              <select
                className="entrada"
                value={elegido ?? ''}
                onChange={(e) => setElegido(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">Todos los roles</option>
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

          {/* Sin filtro se ven los permisos de todos los roles; con un rol elegido, solo los de ese */}
          {(rol ? [rol] : datos.grupos).map((r) => (
            <section key={r.id} className="permisos__rol">
              {!rol && (
                <h2 className="permisos__rol-titulo">
                  {r.nombre}{' '}
                  <span className="texto-suave">
                    ({r.usuarios} usuario{r.usuarios === 1 ? '' : 's'})
                  </span>
                </h2>
              )}
              {r.permisos.length === 0 ? (
                <p className="vacio-tarjeta">El rol {r.nombre} no tiene permisos asignados.</p>
              ) : (
                <div className="tabla-envoltura-ancha">
                  <table className="matriz">
                    <caption className="sr-solo">Permisos del rol {r.nombre}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Sección</th>
                        {ACCIONES.map((a) => (
                          <th key={a.clave} scope="col" className="matriz__columna">
                            {a.texto}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.permisos.map((s) => (
                        <tr key={s.seccion}>
                          <th scope="row">{s.seccion}</th>
                          {ACCIONES.map((a) => (
                            <td key={a.clave} className="matriz__columna">
                              {s.acciones.includes(a.clave) ? (
                                <Check size={18} className="matriz__si" aria-label="Sí" />
                              ) : (
                                <Minus size={16} className="matriz__nada" aria-label="No" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </>
      )}

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
