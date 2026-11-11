import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, CircleCheck, CirclePlay, Clock, VideoOff } from 'lucide-react'
import { tutorialesPara } from './tutoriales'
import './tutorial.css'

// Sección "Tutorial": videos cortos, uno por cada cosa que se puede hacer en
// el sistema. Cada usuario ve solo los de sus funciones (según sus permisos,
// ver tutoriales.js). Los pasos debajo del video saltan a ese momento.
// La dirección guarda el video elegido (/tutorial?video=crear-categoria).

const CLAVE_VISTOS = 'tutoriales-vistos'

function leerVistos() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS) ?? '[]'))
  } catch {
    return new Set()
  }
}

function guardarVistos(vistos) {
  try {
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...vistos]))
  } catch {
    // sin localStorage no se recuerdan los vistos, pero los videos andan igual
  }
}

const duracionTexto = (segundos) => {
  if (!segundos) return ''
  const s = Math.round(segundos)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Reproductor({ tutorial, onVisto }) {
  const video = useRef(null)
  const pantalla = useRef(null)
  const [actual, setActual] = useState(0) // paso que se está viendo
  const [sinVideo, setSinVideo] = useState(!tutorial.video)

  const pasos = tutorial.pasos

  function alAvanzar() {
    const t = video.current?.currentTime ?? 0
    let i = 0
    pasos.forEach((p, j) => {
      if (p.t != null && t >= p.t - 0.2) i = j
    })
    setActual(i)
  }

  function irAPaso(i) {
    setActual(i)
    const p = pasos[i]
    if (!video.current || sinVideo || p.t == null) return
    // Si el video quedó fuera de la vista (pasos de abajo), se lo vuelve a mostrar
    const caja = pantalla.current.getBoundingClientRect()
    if (caja.top < 0 || caja.bottom > window.innerHeight) pantalla.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    video.current.currentTime = p.t
    video.current.play().catch(() => {})
  }

  return (
    <article className="tutorial__reproductor" aria-labelledby="tutorial-titulo">
      <div className="tutorial__pantalla" ref={pantalla}>
        {sinVideo ? (
          <div className="tutorial__sin-video">
            <VideoOff size={40} strokeWidth={1.5} aria-hidden="true" />
            <b>Este tutorial todavía no tiene video</b>
            <span>Seguí los pasos de abajo. Cuando se agregue el video va a aparecer acá.</span>
          </div>
        ) : (
          <video
            ref={video}
            src={tutorial.video}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={alAvanzar}
            onEnded={onVisto}
            onError={() => setSinVideo(true)}
          />
        )}
      </div>

      <header className="tutorial__cabecera">
        <span className="tutorial__grupo">{tutorial.grupo}</span>
        <h2 id="tutorial-titulo">{tutorial.titulo}</h2>
        <p>{tutorial.descripcion}</p>
      </header>

      <section aria-label="Pasos">
        <h3 className="tutorial__subtitulo">Paso a paso</h3>
        <ol className="tutorial__pasos">
          {pasos.map((p, i) => (
            <li key={p.texto}>
              <button
                type="button"
                className={`tutorial__paso${i === actual && !sinVideo ? ' tutorial__paso--actual' : ''}`}
                onClick={() => irAPaso(i)}
                disabled={sinVideo}
              >
                <span className="tutorial__paso-numero">{i + 1}</span>
                <span className="tutorial__paso-texto">{p.texto}</span>
                {!sinVideo && p.t != null && <span className="tutorial__paso-tiempo">{duracionTexto(p.t) || '0:00'}</span>}
              </button>
            </li>
          ))}
        </ol>
        {tutorial.nota && <p className="tutorial__nota">{tutorial.nota}</p>}
      </section>
    </article>
  )
}

function Tutorial({ usuario }) {
  const tutoriales = useMemo(() => tutorialesPara(usuario), [usuario])
  const [parametros, setParametros] = useSearchParams()
  const [vistos, setVistos] = useState(leerVistos)

  const elegido = tutoriales.find((t) => t.id === parametros.get('video')) ?? tutoriales[0]
  const indice = tutoriales.indexOf(elegido)

  // Tutoriales agrupados por sección, en el orden de tutoriales.js
  const grupos = useMemo(() => {
    const mapa = new Map()
    tutoriales.forEach((t, i) => {
      if (!mapa.has(t.grupo)) mapa.set(t.grupo, [])
      mapa.get(t.grupo).push({ ...t, numero: i + 1 })
    })
    return [...mapa]
  }, [tutoriales])

  // Al cambiar de tutorial: arriba de todo, y el elegido visible en la lista
  useEffect(() => {
    document.querySelector('.tutorial')?.scrollTo({ top: 0, behavior: 'smooth' })
    // Solo cuando la lista tiene su propia barra (pantalla ancha); en el celular va debajo del video
    const item = document.querySelector('.tutorial__item[aria-current="true"]')
    const lista = item?.closest('.tutorial__lista')
    if (lista && lista.scrollHeight > lista.clientHeight) {
      lista.scrollTo({ top: item.offsetTop - lista.clientHeight / 2, behavior: 'smooth' })
    }
  }, [elegido?.id])

  function elegir(t) {
    setParametros({ video: t.id }, { replace: true })
  }

  function marcarVisto(id) {
    setVistos((v) => {
      const nuevo = new Set(v).add(id)
      guardarVistos(nuevo)
      return nuevo
    })
  }

  if (!elegido) {
    return (
      <main className="pagina">
        <div className="vacio-tarjeta">
          <b>No hay tutoriales para tu usuario.</b>
          <span>Cuando tengas funciones asignadas vas a ver acá cómo usarlas.</span>
        </div>
      </main>
    )
  }

  const cantidadVistos = tutoriales.filter((t) => vistos.has(t.id)).length

  return (
    <main className="tutorial">
      <header className="pagina__encabezado tutorial__encabezado">
        <div>
          <h1>Tutorial</h1>
          <p>Videos cortos, paso a paso, de todo lo que podés hacer con tu usuario.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="tutorial__progreso" aria-label="Tutoriales vistos">
          <span>
            <b>{cantidadVistos}</b> de {tutoriales.length} vistos
          </span>
          <span className="tutorial__barra" aria-hidden="true">
            <i style={{ width: `${(cantidadVistos / tutoriales.length) * 100}%` }} />
          </span>
        </div>
      </header>

      <div className="tutorial__cuerpo">
        <div className="tutorial__principal">
          {/* key: al cambiar de tutorial el reproductor empieza de cero */}
          <Reproductor key={elegido.id} tutorial={elegido} onVisto={() => marcarVisto(elegido.id)} />

          <nav className="tutorial__navegar" aria-label="Tutorial anterior y siguiente">
            {indice > 0 ? (
              <button type="button" className="boton boton--borde" onClick={() => elegir(tutoriales[indice - 1])}>
                <ChevronLeft size={18} aria-hidden="true" />
                Anterior
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="enlace-boton"
              onClick={() => marcarVisto(elegido.id)}
              disabled={vistos.has(elegido.id)}
            >
              {vistos.has(elegido.id) ? 'Ya lo viste' : 'Marcar como visto'}
            </button>
            {indice < tutoriales.length - 1 ? (
              <button type="button" className="boton" onClick={() => elegir(tutoriales[indice + 1])}>
                Siguiente
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <span />
            )}
          </nav>
        </div>

        <aside className="tutorial__lista" aria-label="Lista de tutoriales">
          {grupos.map(([grupo, items]) => (
            <section key={grupo} className="tutorial__seccion">
              <h3 className="tutorial__seccion-titulo">{grupo}</h3>
              <ul>
                {items.map((t) => {
                  const visto = vistos.has(t.id)
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="tutorial__item"
                        aria-current={t.id === elegido.id ? 'true' : undefined}
                        onClick={() => elegir(t)}
                      >
                        <span className={`tutorial__item-icono${visto ? ' tutorial__item-icono--visto' : ''}`}>
                          {visto ? (
                            <CircleCheck size={20} aria-label="Visto" />
                          ) : t.video ? (
                            <CirclePlay size={20} aria-hidden="true" />
                          ) : (
                            <span className="tutorial__item-numero">{t.numero}</span>
                          )}
                        </span>
                        <span className="tutorial__item-texto">
                          <b>{t.titulo}</b>
                          <small>
                            {t.video ? (
                              <>
                                <Clock size={12} aria-hidden="true" /> {duracionTexto(t.duracion)}
                              </>
                            ) : (
                              'Solo pasos escritos'
                            )}
                            {' · '}
                            {t.pasos.length} pasos
                          </small>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </aside>
      </div>
    </main>
  )
}

export default Tutorial