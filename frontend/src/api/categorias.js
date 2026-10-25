// API de categorías de cuestionarios
import { pedir } from './cliente'

export const obtenerCategorias = () => pedir('/api/categorias/').then((r) => r.categorias)
export const crearCategoria = (datos) =>
  pedir('/api/categorias/', { method: 'POST', datos }).then((r) => r.categoria)
export const editarCategoria = (id, datos) =>
  pedir(`/api/categorias/${id}/`, { method: 'PATCH', datos }).then((r) => r.categoria)
export const borrarCategoria = (id) => pedir(`/api/categorias/${id}/`, { method: 'DELETE' })
