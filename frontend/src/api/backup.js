// Configuración → Backup: backups completos de la base (snapshots de Neon) y
// backup automático. Solo superusuarios. Todas devuelven el estado completo:
// { configurado, faltan, maximo, backups: [{ id, nombre, creado, automatico }],
//   error_neon, aviso, programacion: { activo, frecuencia, dia_semana, hora,
//   proximo, ultimo_automatico, ultimo_error } }
import { pedir } from './cliente'

export const obtenerBackups = () => pedir('/api/backup/')
export const hacerBackup = () => pedir('/api/backup/', { method: 'POST' })
export const borrarBackup = (id) => pedir(`/api/backup/${id}/`, { method: 'DELETE' })
export const guardarProgramacion = (datos) => pedir('/api/backup/programacion/', { method: 'PATCH', datos })

// La base vuelve a como estaba en ese backup. Hay que escribir la palabra RESTAURAR.
export const restaurarBackup = (id, confirmacion) =>
  pedir(`/api/backup/${id}/restaurar/`, { method: 'POST', datos: { confirmacion } })
