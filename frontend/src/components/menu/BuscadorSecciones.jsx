import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Buscador de la barra superior: filtra las opciones del menú y lleva a la elegida.
// Ctrl+K (o Cmd+K) lo enfoca desde cualquier pantalla.
function BuscadorSecciones({ secciones }) {
  const navegar = useNavigate()
  const entrada = useRef(null)
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [marcado, setMarcado] = useState(0)

  const opciones = secciones.flatMap((s) => s.opciones)
  const resultados = texto.trim()
    ? opciones.filter((o) => sinAcentos(o.texto).includes(sinAcentos(texto.trim())))
    : opciones

  useEffect(() => {
    const alTeclear = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        entrada.current?.focus()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  function ir(opcion) {
    navegar(opcion.ruta)
    setTexto('')
    setAbierto(false)
    entrada.current?.blur()
  }

  function alTeclear(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMarcado((m) => Math.min(m + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMarcado((m) => Math.max(m - 1, 0))
    } else if (e.key === 'Enter' && resultados[marcado]) {
      ir(resultados[marcado])
    } else if (e.key === 'Escape') {
      setAbierto(false)
      entrada.current?.blur()
    }
  }

  return (
    <div className="buscador-secciones">
      <Search size={19} aria-hidden="true" />
      <input
        ref={entrada}
        type="search"
        placeholder="Buscar sección…"
        aria-label="Buscar sección"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setMarcado(0)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={alTeclear}
      />
      <kbd>Ctrl K</kbd>
      {abierto && (
        <ul className="buscador-secciones__lista" role="listbox">
          {resultados.length === 0 && <li className="buscador-secciones__vacio">No hay secciones con ese nombre</li>}
          {resultados.map((o, i) => {
            const Icono = o.icono
            return (
              <li
                key={o.ruta}
                role="option"
                aria-selected={i === marcado}
                className={i === marcado ? 'marcado' : undefined}
                // mousedown para que se elija antes de que el input pierda el foco
                onMouseDown={(e) => {
                  e.preventDefault()
                  ir(o)
                }}
                onMouseEnter={() => setMarcado(i)}
              >
                <Icono size={19} aria-hidden="true" />
                {o.texto}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default BuscadorSecciones
