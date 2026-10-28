import {
  ClipboardList,
  ClipboardPen,
  Flag,
  House,
  Map,
  Network,
  ScrollText,
  ShieldCheck,
  Tags,
  Users,
  UsersRound,
} from 'lucide-react'
import { tiene } from '../../permisos'

// Opciones del menú lateral, agrupadas por sección.
// Para sumar una pantalla nueva: agregar su Route en App.jsx y una línea acá.
//   ruta         dirección de la pantalla (la misma que en App.jsx)
//   texto        lo que se ve en el menú
//   descripcion  subtítulo de la tarjeta en la pantalla de Inicio
//   icono        ícono de lucide-react (https://lucide.dev/icons)
//   permiso      permiso de Django que hace falta para verla (el mismo que pide App.jsx)
//   sinCampana   true = se muestra aunque no haya una campaña elegida
//   exacta       true = solo se marca activa en esa dirección exacta (no en sus subrutas)
export const SECCIONES = [
  {
    titulo: null,
    opciones: [{ ruta: '/inicio', texto: 'Inicio', icono: House, exacta: true }],
  },
  {
    titulo: 'Territorio',
    opciones: [
      { ruta: '/mapa', texto: 'Mapa', descripcion: 'Barrios, zonas y rutas', icono: Map, permiso: 'core.view_zona' },
      {
        ruta: '/equipos',
        texto: 'Equipos',
        descripcion: 'Equipos y sus rutas',
        icono: Network,
        permiso: 'core.view_equipo',
      },
    ],
  },
  {
    titulo: 'Encuestas',
    opciones: [
      {
        ruta: '/cuestionarios',
        texto: 'Cuestionarios',
        descripcion: 'Formularios de campo',
        icono: ClipboardList,
        permiso: 'core.view_cuestionario',
      },
      {
        ruta: '/categorias',
        texto: 'Categorías',
        descripcion: 'Temas de las preguntas',
        icono: Tags,
        permiso: 'core.view_categoria',
      },
      {
        ruta: '/responder',
        texto: 'Cargar encuesta',
        descripcion: 'Responder en territorio',
        icono: ClipboardPen,
        permiso: 'core.add_encuesta',
      },
    ],
  },
  {
    titulo: 'Gestión',
    opciones: [
      { ruta: '/usuarios', texto: 'Usuarios', descripcion: 'Cuentas y grupos', icono: Users, permiso: 'core.view_usuario' },
      {
        ruta: '/grupos',
        texto: 'Grupos',
        descripcion: 'Grupos con sus permisos',
        icono: UsersRound,
        permiso: 'core.view_grupo',
      },
      {
        ruta: '/permisos',
        texto: 'Permisos',
        descripcion: 'Qué puede hacer cada grupo',
        icono: ShieldCheck,
        permiso: 'auth.view_group',
      },
      {
        ruta: '/actividad',
        texto: 'Actividad',
        descripcion: 'Historial de cambios',
        icono: ScrollText,
        permiso: 'admin.view_logentry',
      },
      {
        ruta: '/campanas',
        texto: 'Campañas',
        descripcion: 'Alta y estado de campañas',
        icono: Flag,
        permiso: 'core.view_campana',
        sinCampana: true,
      },
    ],
  },
]

// Secciones con solo las opciones que puede ver este usuario (sin secciones vacías).
// Sin campaña elegida solo quedan las opciones marcadas con sinCampana.
export function seccionesPara(usuario) {
  return SECCIONES.map((s) => ({
    ...s,
    opciones: s.opciones.filter(
      (o) => (!o.permiso || tiene(usuario, o.permiso)) && (usuario.campana || o.sinCampana),
    ),
  })).filter((s) => s.opciones.length > 0)
}

// Opción que corresponde a la dirección actual (ej: /cuestionarios/5 → Cuestionarios)
export function opcionActual(secciones, pathname) {
  const todas = secciones.flatMap((s) => s.opciones)
  return todas.find((o) => pathname === o.ruta || (!o.exacta && pathname.startsWith(`${o.ruta}/`)))
}