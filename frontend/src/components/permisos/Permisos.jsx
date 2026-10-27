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

  // Columnas: el permiso propio "Administrar la campaña" y cada grupo
  const columnas = [
    {
      id: 'administrar',
      nombre: 'Administrar la campaña',
      detalle: `Permiso · ${datos.propios.find((p) => p.codigo === 'core.administrar_campana')?.usuarios ?? 0} usuario(s)`,
      permisos: datos.administrar,
    },
    ...datos.grupos.map((g) => ({
      id: g.id,
      nombre: g.nombre,
      detalle: `Grupo · ${g.usuarios} usuario${g.usuarios === 1 ? '' : 's'}`,
      permisos: g.permisos,
    })),
  ]
  const permisosDe = (columna, seccion) => columna.permisos.find((p) => p.seccion === seccion)?.acciones ?? []
  const secciones = datos.secciones.filter((s) => columnas.some((c) => permisosDe(c, s.seccion).length))

  return (
    <main className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Permisos</h1>
          <p>Qué permite cada permiso y cada grupo. Son las tablas de Django (permisos, grupos y grupos por permisos): acá solo se consultan.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      <p className="aviso-info">
        {datos.superusuario} Para darle permisos a una persona, marcalos en Gestión → Usuarios. Los grupos y sus permisos
        se cambian desde el admin de Django (/admin).
      </p>

      <div className="tabla-envoltura-ancha">
        <table className="matriz">
          <caption className="sr-solo">Permisos por grupo y sección</caption>
          <thead>
            <tr>
              <th scope="col">Sección</th>
              {columnas.map((c) => (
                <th key={c.id} scope="col">
                  {c.nombre}
                  <small>{c.detalle} en la campaña</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {secciones.map((s) => (
              <tr key={s.seccion}>
                <th scope="row">{s.seccion}</th>
                {columnas.map((c) => {
                  const tiene = permisosDe(c, s.seccion)
                  return (
                    <td key={c.id}>
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

      <h2 className="permisos__titulo">Usuarios de la campaña</h2>
      {datos.usuarios.length === 0 ? (
        <p className="vacio-tarjeta">No hay usuarios activos en esta campaña.</p>
      ) : (
        <ul className="permisos__usuarios">
          {datos.usuarios.map((u) => (
            <li key={u.id}>
              <b>{u.nombre}</b>
              <span className="texto-suave">{u.email}</span>
              <span className="permisos__grupos">
                {u.directos.some((d) => d.acciones.includes('Puede administrar la campaña')) && (
                  <span className="etiqueta etiqueta--violeta">Administra la campaña</span>
                )}
                {u.grupos.length ? (
                  u.grupos.map((g) => (
                    <span key={g} className="etiqueta etiqueta--magenta">
                      {g}
                    </span>
                  ))
                ) : (
                  !u.directos.length && <span className="etiqueta">Sin permisos</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default Permisos
