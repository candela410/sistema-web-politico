import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ClipboardList, FilePlus2, Mail } from 'lucide-react'
import { obtenerCuestionarios } from '../../api/cuestionarios'
import { obtenerParaResponder } from '../../api/encuestas'
import { obtenerRutas, obtenerZonas } from '../../api/mapa'
import { inicialDe, nombreDe, rolDe } from '../menu/usuario'
import { seccionesPara } from '../menu/opciones'
import './inicio.css'

const COLORES = ['celeste', 'violeta', 'naranja', 'magenta']
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Números del tablero según el rol. Si un pedido falla, ese número queda en "–"
async function cargarResumen(usuario) {
  const cantidad = (promesa) => promesa.then((l) => l.length).catch(() => null)

  if (!usuario.es_staff) {
    return { numeros: [{ texto: 'Encuestas para cargar', valor: await cantidad(obtenerParaResponder()) }], ultimos: [] }
  }

  const [cuestionarios, zonas, rutas] = await Promise.all([
    obtenerCuestionarios().catch(() => null),
    cantidad(obtenerZonas()),
    cantidad(obtenerRutas()),
  ])
  return {
    numeros: [
      { texto: 'Cuestionarios activos', valor: cuestionarios && cuestionarios.filter((c) => c.activo).length },
      { texto: 'Encuestas cargadas', valor: cuestionarios && cuestionarios.reduce((t, c) => t + c.encuestas, 0) },
      { texto: 'Zonas', valor: zonas },
      { texto: 'Rutas', valor: rutas },
    ],
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
        </section>

        <section className="inicio__caja">
          <h3>Accesos directos</h3>
          <div className="inicio__accesos">
            {usuario.es_staff && (
              <Link to="/cuestionarios/nuevo">
                <FilePlus2 size={18} aria-hidden="true" />
                Nuevo cuestionario
              </Link>
            )}
            <Link to="/responder">
              <ClipboardList size={18} aria-hidden="true" />
              Cargar encuesta
            </Link>
          </div>
        </section>
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

        <section className="inicio__caja inicio__numeros" aria-label="Resumen">
          {(resumen?.numeros ?? [{ texto: 'Cargando…', valor: null }]).map((n, i) => (
            <div key={n.texto} className={`inicio__numero inicio__numero--${COLORES[(i + 1) % COLORES.length]}`}>
              <strong>{resumen ? (n.valor ?? '–') : '·'}</strong>
              <span>{n.texto}</span>
            </div>
          ))}
        </section>

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

      {usuario.es_staff && (
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
                    <Link to={`/cuestionarios/${c.id}/detalle`}>
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
