import { ClipboardList, ClipboardPen, House, Map, Tags } from 'lucide-react'

// Opciones del menú lateral, agrupadas por sección.
// Para sumar una pantalla nueva: agregar su Route en App.jsx y una línea acá.
//   ruta       dirección de la pantalla (la misma que en App.jsx)
//   texto      lo que se ve en el menú
//   descripcion  subtítulo de la tarjeta en la pantalla de Inicio
//   icono      ícono de lucide-react (https://lucide.dev/icons)
//   soloAdmin  true = no se muestra a los militantes
//   exacta     true = solo se marca activa en esa dirección exacta (no en sus subrutas)
export const SECCIONES = [
  {
    titulo: null,
    opciones: [{ ruta: '/inicio', texto: 'Inicio', icono: House, exacta: true }],
  },
  {
    titulo: 'Territorio',
    opciones: [{ ruta: '/mapa', texto: 'Mapa', descripcion: 'Barrios, zonas y rutas', icono: Map, soloAdmin: true }],
  },
  {
    titulo: 'Encuestas',
    opciones: [
      { ruta: '/cuestionarios', texto: 'Cuestionarios', descripcion: 'Formularios de campo', icono: ClipboardList, soloAdmin: true },
      { ruta: '/categorias', texto: 'Categorías', descripcion: 'Temas de las preguntas', icono: Tags, soloAdmin: true },
      { ruta: '/responder', texto: 'Cargar encuesta', descripcion: 'Responder en territorio', icono: ClipboardPen },
    ],
  },
]

// Secciones con solo las opciones que puede ver este usuario (sin secciones vacías)
export function seccionesPara(usuario) {
  return SECCIONES.map((s) => ({
    ...s,
    opciones: s.opciones.filter((o) => !o.soloAdmin || usuario.es_staff),
  })).filter((s) => s.opciones.length > 0)
}

// Opción que corresponde a la dirección actual (ej: /cuestionarios/5 → Cuestionarios)
export function opcionActual(secciones, pathname) {
  const todas = secciones.flatMap((s) => s.opciones)
  return todas.find((o) => pathname === o.ruta || (!o.exacta && pathname.startsWith(`${o.ruta}/`)))
}
