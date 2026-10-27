import { useEffect, useState } from 'react'
import { obtenerPermisos } from '../../api/usuarios'
import './permisos.css'

// Permisos de Django por grupo, solo para consultar. Se asignan desde el
// admin de Django; en la app se eligen grupos al crear o editar un usuario.
const ACCIONES = ['Ver', 'Crear', 'Editar', 'Borrar']

function Permisos() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerPermisos()
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [])

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

  const permisosDe = (grupo, seccion) => grupo.permisos.find((p) => p.seccion === seccion)?.acciones ?? []
  // Solo las secciones que tiene algún grupo, más las que ya existen en Django
  const secciones = datos.secciones.filter((s) => datos.grupos.some((g) => permisosDe(g, s.seccion).length))

  return (
    <main className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Permisos</h1>
          <p>Qué puede hacer cada grupo. Son los permisos de Django: acá solo se consultan.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      <p className="aviso-info">
        {datos.superusuario} Para cambiar qué puede hacer un grupo se usa el admin de Django (/admin). Para darle permisos a
        una persona, agregala a un grupo desde Gestión → Usuarios.
      </p>

      <div className="tabla-envoltura-ancha">
        <table className="matriz">
          <caption className="sr-solo">Permisos por grupo y sección</caption>
          <thead>
            <tr>
              <th scope="col">Sección</th>
              {datos.grupos.map((g) => (
                <th key={g.id} scope="col">
                  {g.nombre}
                  <small>
                    {g.usuarios} usuario{g.usuarios === 1 ? '' : 's'} en la campaña
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {secciones.map((s) => (
              <tr key={s.seccion}>
                <th scope="row">{s.seccion}</th>
                {datos.grupos.map((g) => {
                  const tiene = permisosDe(g, s.seccion)
                  return (
                    <td key={g.id}>
                      {tiene.length === 0 ? (
                        <span className="matriz__nada" aria-label="Sin permisos">
                          —
                        </span>
                      ) : (
                        <span className="matriz__acciones">
                          {[...ACCIONES, ...tiene.filter((a) => !ACCIONES.includes(a))]
                            .filter((a) => tiene.includes(a))
                            .map((a) => (
                              <span key={a} className={`permiso permiso--${ACCIONES.indexOf(a)}`}>
                                {a}
                              </span>
                            ))}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="permisos__titulo">Usuarios de la campaña y sus grupos</h2>
      {datos.usuarios.length === 0 ? (
        <p className="vacio-tarjeta">No hay usuarios activos en esta campaña.</p>
      ) : (
        <ul className="permisos__usuarios">
          {datos.usuarios.map((u) => (
            <li key={u.id}>
              <b>{u.nombre}</b>
              <span className="texto-suave">{u.email}</span>
              <span className="permisos__grupos">
                {u.grupos.length ? (
                  u.grupos.map((g) => (
                    <span key={g} className="etiqueta etiqueta--violeta">
                      {g}
                    </span>
                  ))
                ) : (
                  <span className="etiqueta">Sin grupo</span>
                )}
                {u.directos.length > 0 && <span className="etiqueta">+ permisos individuales</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default Permisos
