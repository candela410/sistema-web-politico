// API de los avisos de la campanita (barra superior)
import { pedir } from './cliente'

export const obtenerAvisos = () => pedir('/api/avisos/').then((r) => r.avisos)