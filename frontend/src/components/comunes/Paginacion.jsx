import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './Paginacion.css'

// Paginación de todos los listados: de a POR_PAGINA registros. usePaginado
// pagina listas que ya están en el navegador; el componente también sirve
// para listas que pagina el servidor (Actividad), pasándole los mismos datos.
export const POR_PAGINA = 15

export function usePaginado(lista, porPagina = POR_PAGINA) {
  const [pagina, setPagina] = useState(1)
  const [largo, setLargo] = useState(lista.length)
  // Si la lista cambia de tamaño (búsqueda, filtros, altas o bajas) se vuelve a la primera página
  if (largo !== lista.length) {
    setLargo(lista.length)
    setPagina(1)
  }
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina))
  const actual = Math.min(pagina, paginas)
  return {
    items: lista.slice((actual - 1) * porPagina, actual * porPagina),
    pagina: actual,
    paginas,
    total: lista.length,
    porPagina,
    irA: setPagina,
  }
}

// Números a mostrar: siempre la primera y la última, y dos alrededor de la
// actual; los saltos se marcan con "…" (1 … 4 5 6 … 12)
function numeros(pagina, paginas) {
  const lista = []
  for (let n = 1; n <= paginas; n++) {
    if (n === 1 || n === paginas || Math.abs(n - pagina) <= 1) lista.push(n)
    else if (lista[lista.length - 1] !== '…') lista.push('…')
  }
  return lista
}

function Paginacion({ pagina, paginas, total, porPagina = POR_PAGINA, irA, contenedor = '.pagina' }) {
  if (paginas <= 1) return null
  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)
  const ir = (n) => {
    irA(n)
    // La lista se desplaza dentro de su contenedor: se vuelve arriba de todo
    document.querySelector(contenedor)?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <nav className="paginacion" aria-label="Páginas">
      <span className="paginacion__resumen">
        Mostrando {desde}–{hasta} de {total.toLocaleString('es-AR')}
      </span>
      <div className="paginacion__botones">
        <button
          type="button"
          className="paginacion__boton"
          disabled={pagina <= 1}
          onClick={() => ir(pagina - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {numeros(pagina, paginas).map((n, i) =>
          n === '…' ? (
            <span key={`salto-${i}`} className="paginacion__salto" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`paginacion__boton${n === pagina ? ' paginacion__boton--actual' : ''}`}
              aria-current={n === pagina ? 'page' : undefined}
              aria-label={`Página ${n}`}
              onClick={() => n !== pagina && ir(n)}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="paginacion__boton"
          disabled={pagina >= paginas}
          onClick={() => ir(pagina + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

export default Paginacion
