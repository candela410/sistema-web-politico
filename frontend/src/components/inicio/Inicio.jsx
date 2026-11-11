import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Flag, Mail } from 'lucide-react'
import { obtenerCuestionarios } from '../../api/cuestionarios'
import { obtenerEncuestasPorDia, obtenerParaResponder } from '../../api/encuestas'
import { obtenerRutas, obtenerZonas } from '../../api/mapa'
import { tiene } from '../../permisos'
import { inicialDe, nombreDe, rolDe } from '../menu/usuario'
import { seccionesPara } from '../menu/opciones'
import './inicio.css'

const COLORES = ['celeste', 'violeta', 'naranja', 'magenta']

// Accesos de la pantalla de inicio: solo las secciones del día a día, en este
// orden y con su color. Categorías, roles, permisos, actividad y campañas
// quedan solo en el menú lateral.
const TARJETAS = [
  { ruta: '/cuestionarios', color: 'violeta' },
  { ruta: '/responder', color: 'magenta' },
  { ruta: '/mapa', color: 'celeste' },
  { ruta: '/equipos', color: 'naranja' },
  { ruta: '/usuarios', color: 'violeta' },
]

// Cuántas columnas (de 6) ocupa cada tarjeta según cuántas hay, para que
// las filas queden completas: con 5, las dos primeras van más grandes.
const ANCHOS = { 1: [6], 2: [3, 3], 3: [2, 2, 2], 4: [3, 3, 3, 3], 5: [3, 3, 2, 2, 2] }
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

// Fecha local como AAAA-MM-DD (toISOString la pasaría a UTC y podría cambiar de día)
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function semanaActual() {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return {
      dia: DIAS[i],
      numero: d.getDate(),
      fecha: isoLocal(d),
      esHoy: d.toDateString() === hoy.toDateString(),
      futuro: d > hoy,
    }
  })
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

// Número del tablero que cuenta desde 0 hasta su valor (700ms, frenando al final).
// Con "reducir movimiento" (o si es 0) se muestra el valor directamente.
const DURACION_CONTEO = 700
const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Contador({ valor }) {
  const [conteo, setConteo] = useState({ valor: null, mostrado: 0 })
  const animar = valor > 0 && !sinMovimiento()

  useEffect(() => {
    if (!animar) return
    let cuadro
    const inicio = performance.now()
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_CONTEO)
      const frenado = 1 - (1 - t) ** 3
      setConteo({ valor, mostrado: Math.round(valor * frenado) })
      if (t < 1) cuadro = requestAnimationFrame(paso)
    }
    cuadro = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(cuadro)
  }, [valor, animar])

  const numero = !animar ? valor : conteo.valor === valor ? conteo.mostrado : 0
  return numero.toLocaleString('es-AR')
}

// Pantalla de inicio: saludo, números generales y accesos a las secciones del menú
function Inicio({ usuario }) {
  const [resumen, setResumen] = useState(null)
  const permitidas = seccionesPara(usuario).flatMap((s) => s.opciones)
  const tarjetas = TARJETAS.map((t) => {
    const opcion = permitidas.find((o) => o.ruta === t.ruta)
    return opcion && { ...opcion, color: t.color }
  }).filter(Boolean)
  const anchos = ANCHOS[tarjetas.length] ?? []

  useEffect(() => {
    cargarResumen(usuario).then(setResumen)
  }, [usuario])

  const [semana] = useState(semanaActual)
  // Encuestas cargadas cada día de esta semana (solo si puede verlas): { fecha: cantidad }
  const verEncuestas = tiene(usuario, 'core.view_encuesta')
  const [porDia, setPorDia] = useState(null)
  useEffect(() => {
    if (!verEncuestas) return
    obtenerEncuestasPorDia(semana[0].fecha, semana[6].fecha)
      .then((dias) => setPorDia(Object.fromEntries(dias.map((d) => [d.fecha, d.encuestas]))))
      .catch(() => setPorDia(null))
  }, [verEncuestas, semana])
  const maximo = porDia ? Math.max(1, ...Object.values(porDia)) : 1
  const totalSemana = porDia ? Object.values(porDia).reduce((t, n) => t + n, 0) : 0
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

        {tiene(usuario, 'core.view_cuestionario') && (
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
                <strong>{resumen ? n.valor == null ? '–' : <Contador valor={n.valor} /> : '·'}</strong>
                <span>{n.texto}</span>
              </div>
            ))}
          </section>
        )}

        <section className="inicio__tarjetas" aria-label="Secciones">
          {tarjetas.map(({ ruta, texto, descripcion, icono: Icono, color }, i) => (
            <Link
              key={ruta}
              to={ruta}
              className={`inicio__tarjeta inicio__tarjeta--${color}${anchos[i] === 3 ? ' inicio__tarjeta--grande' : ''}`}
              style={{ '--columnas': anchos[i] ?? 2 }}
            >
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
                {porDia && (
                  <span
                    className="inicio__barra"
                    title={d.futuro ? undefined : `${porDia[d.fecha] ?? 0} encuestas`}
                    aria-hidden={d.futuro || undefined}
                  >
                    {!d.futuro && (
                      <>
                        <i style={{ '--alto': (porDia[d.fecha] ?? 0) / maximo, '--orden': i }} />
                        <small>{porDia[d.fecha] ?? 0}</small>
                      </>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {porDia && (
            <p className="inicio__semana-total">
              {totalSemana === 1 ? '1 encuesta cargada' : `${totalSemana} encuestas cargadas`} esta semana
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default Inicio