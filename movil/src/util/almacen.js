// Reemplazo de localStorage: AsyncStorage guarda en el celular.
// Además se mantiene una copia en memoria para leer de forma sincrónica
// (se carga entera al abrir la app con cargarAlmacen()).
import AsyncStorage from '@react-native-async-storage/async-storage'

const memoria = new Map()

export async function cargarAlmacen() {
  try {
    const claves = await AsyncStorage.getAllKeys()
    const pares = await AsyncStorage.multiGet(claves)
    pares.forEach(([k, v]) => v != null && memoria.set(k, v))
  } catch {
    // sin almacenamiento: todo dura mientras la app esté abierta
  }
}

export const leer = (clave, porDefecto = null) => (memoria.has(clave) ? memoria.get(clave) : porDefecto)

export function guardar(clave, valor) {
  if (valor == null) {
    memoria.delete(clave)
    AsyncStorage.removeItem(clave).catch(() => {})
  } else {
    memoria.set(clave, String(valor))
    AsyncStorage.setItem(clave, String(valor)).catch(() => {})
  }
}
