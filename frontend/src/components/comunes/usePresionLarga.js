import { useEffect, useRef } from 'react'

// Pulsación larga en pantallas táctiles (como onLongPress + delayLongPress de
// Pressable). Devuelve los eventos para poner en el elemento:
// - onPointerDown (onPressIn): empieza a contar.
// - onPointerUp / onPointerCancel / onPointerLeave (onPressOut): deja de contar.
// - onPointerMove: si el dedo se mueve más de `tolerancia` px se cancela
//   (como pressRetentionOffset: arrastrar para desplazar la página no cuenta).
// - onClickCapture: después de una pulsación larga no se ejecuta el clic
//   (onPress), así mantener apretado nunca dispara la acción del botón.
// - onContextMenu: evita el menú del navegador que abre la pulsación larga.
// Con el mouse no hace nada: ahí alcanza con pasar el cursor por encima.
export default function usePresionLarga(alPresionarLargo, { demora = 500, tolerancia = 10 } = {}) {
  const reloj = useRef(null)
  const inicio = useRef(null)
  const fue = useRef(false)

  useEffect(() => () => clearTimeout(reloj.current), [])

  const cancelar = () => {
    clearTimeout(reloj.current)
    inicio.current = null
  }

  return {
    onPointerDown(e) {
      fue.current = false
      if (e.pointerType === 'mouse') return
      inicio.current = { x: e.clientX, y: e.clientY }
      clearTimeout(reloj.current)
      reloj.current = setTimeout(() => {
        fue.current = true
        inicio.current = null
        alPresionarLargo(e)
      }, demora)
    },
    onPointerMove(e) {
      if (!inicio.current) return
      if (Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > tolerancia) cancelar()
    },
    onPointerUp: cancelar,
    onPointerCancel: cancelar,
    onPointerLeave: cancelar,
    onClickCapture(e) {
      if (!fue.current) return
      fue.current = false
      e.preventDefault()
      e.stopPropagation()
    },
    onContextMenu(e) {
      if (inicio.current || fue.current) e.preventDefault()
    },
    // true si la última pulsación fue larga
    fueLarga: () => fue.current,
  }
}
