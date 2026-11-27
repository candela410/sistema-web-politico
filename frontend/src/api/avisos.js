// API de los avisos de la campanita (barra superior): las notificaciones del usuario
import { pedir } from './cliente'

// { avisos: [...], sin_leer: n }
export const obtenerAvisos = () => pedir('/api/avisos/')

// Marca como leídos todos los avisos del usuario
export const marcarLeidos = () => pedir('/api/avisos/leidas/', { method: 'POST' })
