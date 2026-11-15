// Modo claro / oscuro. La elección se recuerda en este navegador y se aplica
// poniendo data-tema en <html> (los colores están en index.css). Al cargar la
// página lo aplica un script de index.html, antes de que se dibuje nada.
import { useEffect, useState } from 'react'

const CLAVE = 'tema'

export function temaGuardado() {
  try {
    return localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro'
  } catch {
    return 'claro'
  }
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema
  // Bootstrap (desplegables, ventanas) tiene su propio modo oscuro
  document.documentElement.dataset.bsTheme = tema === 'oscuro' ? 'dark' : 'light'
}

// [tema, alternar]: para el botón sol/luna
export function useTema() {
  const [tema, setTema] = useState(temaGuardado)
  useEffect(() => {
    aplicarTema(tema)
    try {
      localStorage.setItem(CLAVE, tema)
    } catch {
      // Sin almacenamiento: dura mientras la página esté abierta
    }
  }, [tema])
  return [tema, () => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'))]
}
