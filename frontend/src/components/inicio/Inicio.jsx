import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ClipboardList, FilePlus2, Flag, Mail } from 'lucide-react'
import { obtenerCuestionarios } from '../../api/cuestionarios'
import { obtenerParaResponder } from '../../api/encuestas'
import { obtenerRutas, obtenerZonas } from '../../api/mapa'
import { tiene } from '../../permisos'
import { inicialDe, nombreDe, rolDe } from '../menu/usuario'
import { seccionesPara } from '../menu/opciones'
import './inicio.css'

const COLORES = ['celeste', 'violeta', 'naranja', 'magenta']
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Números del tablero según los permisos del usuario: solo se pide lo que puede ver.
// Si un pedido falla, ese número queda en "–"
async function cargarResumen(usuario) {
  const cantidad = (promesa) => promesa.then((l) => l.length).catch(() => null)
  const si = (permiso, pedir) => (tiene(usuario, permiso) ? pedir() : undefined)

  const [cuestionarios, zonas, rutas, paraCargar] = await Promise.all([
    si('core.view_cuestionario', () => obtenerCuestionarios().catch(() => null)),
    si('core.view_zona', () => cantidad(obtenerZonas())),
    si('core.view_ruta', () => cantidad(obtenerRutas())),
    si('core.add_encuesta', () => cantidad(obtenerParaResponder())),
  ])
  const numeros = [
    cuestionarios !== undefined && {
      texto: 'Cuestionarios activos',
      valor: cuestionarios && cuestionarios.filter((c) => c.activo).length,
    },
    cuestionarios !== undefined && {
      texto: 'Encuestas cargadas',
      valor: cuestionarios && cuestionarios.reduce((t, c) => t + c.encuestas, 0),
    },
    zonas !== undefined && { texto: 'Zonas', valor: zonas },
    rutas !== undefined && { texto: 'Rutas', valor: rutas },
    paraCargar !== undefined && { texto: 'Encuestas para cargar', valor: paraCargar },
  ].filter(Boolean)
  return {
    numeros: numeros.slice(0, 4),
    ultimos: [...(cuestionarios ?? [])]
      .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
      .slice(0, 4),
  }
}

function semanaActual() {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return { dia: DIAS[i], numero: d.getDate(), esHoy: d.toDateString() === hoy.toDateString() }
  })
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

// Pantalla de inicio: saludo, números generales y accesos a las secciones del menú
function Inicio({ usuario }) {
  const [resumen, setResumen] = useState(null)
  const tarjetas = seccionesPara(usuario)
    .flatMap((s) => s.opciones)
    .filter((o) => o.ruta !== '/inicio')
  const accesos = [
    { ruta: '/cuestionarios/nuevo', texto: 'Nuevo cuestionario', icono: FilePlus2, permiso: 'core.add_cuestionario' },
    { ruta: '/responder', texto: 'Cargar encuesta', icono: ClipboardList, permiso: 'core.add_encuesta' },
  ].filter((a) => tiene(usuario, a.permiso))

  useEffect(() => {
    cargarResumen(usuario).then(setResumen)
  }, [usuario])

  const [semana] = useState(semanaActual)
  const [mes] = useState(() => {
    const texto = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return texto.charAt(0).toUpperCase() + texto.slice(1)
  })

  return (
    <main className="inicio">
      <aside className="inicio__columna">
        <section className="inicio__caja inicio__perfil">
          <span className="inicio__avatar">{inicialDe(usuario)}</span>
          <h2>{nombreDe(usuario)}</h2>
          <span className="inicio__rol">{rolDe(usuario)}</span>
          <p title={usuario.email}>
            <Mail size={14} aria-hidden="true" />
            <span>{usuario.email}</span>
          </p>
          {usuario.campana && (
            <p className="inicio__campana" title="Campaña activa">
              <Flag size={14} aria-hidden="true" />
              <span>{usuario.campana.nombre}</span>
            </p>
          )}
        </section>

        {accesos.length > 0 && (
          <section className="inicio__caja">
            <h3>Accesos directos</h3>
            <div className="inicio__accesos">
              {accesos.map(({ ruta, texto, icono: Icono }) => (
                <Link key={ruta} to={ruta}>
                  <Icono size={18} aria-hidden="true" />
                  {texto}
                </Link>
              ))}
            </div>
          </section>
        )}
      </aside>

      <div className="inicio__centro">
        <header className="inicio__saludo">
          <h1>Hola, {usuario.nombre || nombreDe(usuario)} 👋</h1>
          <p>¿Qué querés gestionar hoy?</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </header>

        {tarjetas.length === 0 && (
          <section className="inicio__caja">
            <h3>Todavía no tenés secciones habilitadas</h3>
            <p className="inicio__vacio">Pedile a la administración que te agregue a un grupo con permisos.</p>
          </section>
        )}

        {(resumen === null || resumen.numeros.length > 0) && (
          <section className="inicio__caja inicio__numeros" aria-label="Resumen">
            {(resumen?.numeros ?? [{ texto: 'Cargando…', valor: null }]).map((n, i) => (
              <div key={n.texto} className={`inicio__numero inicio__numero--${COLORES[(i + 1) % COLORES.length]}`}>
                <strong>{resumen ? (n.valor ?? '–') : '·'}</strong>
                <span>{n.texto}</span>
              </div>
            ))}
          </section>
        )}

        <section className="inicio__tarjetas" aria-label="Secciones">
          {tarjetas.map(({ ruta, texto, descripcion, icono: Icono }, i) => (
            <Link key={ruta} to={ruta} className={`inicio__tarjeta inicio__tarjeta--${COLORES[i % COLORES.length]}`}>
              <span className="inicio__tarjeta-icono">
                <Icono size={22} aria-hidden="true" />
              </span>
              <span className="inicio__tarjeta-pie">
                <span>
                  <strong>{texto}</strong>
                  {descripcion && <small>{descripcion}</small>}
                </span>
                <span className="inicio__tarjeta-flecha">
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </span>
            </Link>
          ))}
        </section>

        <section className="inicio__caja">
          <div className="inicio__caja-encabezado">
            <h3>Esta semana</h3>
            <span>{mes}</span>
          </div>
          <ol className="inicio__semana">
            {semana.map((d, i) => (
              <li key={i} className={d.esHoy ? 'hoy' : undefined} aria-current={d.esHoy ? 'date' : undefined}>
                <span>{d.dia}</span>
                <strong>{d.numero}</strong>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {tiene(usuario, 'core.view_cuestionario') && (
        <aside className="inicio__columna">
          <section className="inicio__caja">
            <h3>Últimos cuestionarios</h3>
            {resumen === null ? (
              <p className="inicio__vacio">Cargando…</p>
            ) : resumen.ultimos.length === 0 ? (
              <p className="inicio__vacio">Cuando se creen cuestionarios, vas a ver acá los últimos.</p>
            ) : (
              <ul className="inicio__ultimos">
                {resumen.ultimos.map((c) => (
                  <li key={c.id}>
                    <Link to={tiene(usuario, 'core.view_encuesta') ? `/cuestionarios/${c.id}/estadisticas` : `/cuestionarios/${c.id}`}>
                      <strong>{c.titulo}</strong>
                      <span>
                        {fechaCorta(c.creado_en)} · {c.encuestas === 1 ? '1 encuesta' : `${c.encuestas} encuestas`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      )}
    </main>
  )
}

export default Inicio
