// API de los avisos de la campanita (barra superior): las notificaciones del usuario
import { pedir } from './cliente'

// { avisos: [...], sin_leer: n }
export const obtenerAvisos = () => pedir('/api/avisos/')

// Marca como leídos todos los avisos del usuario
export const marcarLeidos = () => pedir('/api/avisos/leidas/', { method: 'POST' })

// Configuración → Notificaciones: qué avisos quiere recibir el usuario
export const obtenerPreferencias = () => pedir('/api/avisos/preferencias/').then((r) => r.preferencias)
export const guardarPreferencia = (tipo, recibir) =>
  pedir('/api/avisos/preferencias/', { method: 'PUT', datos: { [tipo]: recibir } }).then((r) => r.preferencias)
