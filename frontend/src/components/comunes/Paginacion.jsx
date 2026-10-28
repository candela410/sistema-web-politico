import { useState } from 'react'
import './Paginacion.css'

// Paginación de listas que ya están en el navegador (de a POR_PAGINA elementos)
export const POR_PAGINA = 10

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

function Paginacion({ pagina, paginas, total, porPagina, irA }) {
  if (paginas <= 1) return null
  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)
  const ir = (n) => {
    irA(n)
    // La lista se desplaza dentro de .pagina: se vuelve arriba de todo
    document.querySelector('.pagina')?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <nav className="paginacion" aria-label="Páginas">
      <button type="button" className="boton boton--borde boton--chico" disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>
        ← Anterior
      </button>
      <span>
        {desde}–{hasta} de {total} · Página {pagina} de {paginas}
      </span>
      <button
        type="button"
        className="boton boton--borde boton--chico"
        disabled={pagina >= paginas}
        onClick={() => ir(pagina + 1)}
      >
        Siguiente →
      </button>
    </nav>
  )
}

export default Paginacion
