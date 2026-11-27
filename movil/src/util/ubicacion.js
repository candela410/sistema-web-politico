// Ubicación GPS del celular al enviar una encuesta (expo-location).
//
// Regla: la encuesta se carga con la ubicación real del lugar donde se hizo.
// Nunca se inventan coordenadas ni se usa una ubicación por defecto: si no se
// puede obtener una ubicación válida, se lanza un ErrorUbicacion con un
// mensaje para la persona y la encuesta no se envía.
import * as Location from 'expo-location'

// Primero se pide la ubicación de alta precisión (GPS, ayudado por Wi-Fi y
// redes móviles). Si no llega a tiempo (por ejemplo, adentro de un edificio),
// se pide la ubicación de precisión media del sistema, que usa Wi-Fi y antenas.
// Las dos son lecturas reales del dispositivo; si ninguna llega, no se envía.
const INTENTOS = [
  { accuracy: Location.Accuracy.High, espera: 15000 },
  { accuracy: Location.Accuracy.Balanced, espera: 10000 },
]

export class ErrorUbicacion extends Error {
  // codigo: 'permiso' | 'permiso_bloqueado' | 'gps_apagado' | 'sin_senal' | 'invalida'
  constructor(codigo, mensaje) {
    super(mensaje)
    this.codigo = codigo
  }
}

export const MENSAJES = {
  permiso:
    'Para enviar la encuesta hace falta permitir el acceso a la ubicación. Toque «Reintentar» y elija «Permitir».',
  permiso_bloqueado:
    'El acceso a la ubicación está bloqueado para esta app. Habilítelo en la configuración del celular y vuelva a intentar.',
  gps_apagado: 'La ubicación (GPS) del celular está desactivada. Actívela y vuelva a intentar.',
  sin_senal:
    'No se pudo obtener la ubicación (sin señal de GPS). Pruebe en un lugar abierto o espere unos segundos y vuelva a intentar.',
  invalida: 'La ubicación obtenida no es válida. Vuelva a intentar.',
}

// Coordenada real: número finito dentro del rango; (0, 0) es lo que devuelven
// algunos GPS sin señal y no se acepta
export function coordenadasValidas(latitud, longitud) {
  const ok = (v, max) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max
  return ok(latitud, 90) && ok(longitud, 180) && !(latitud === 0 && longitud === 0)
}

function conEspera(promesa, ms) {
  let reloj
  const corte = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new ErrorUbicacion('sin_senal', MENSAJES.sin_senal)), ms)
  })
  return Promise.race([promesa, corte]).finally(() => clearTimeout(reloj))
}

// Pide permiso (si hace falta), comprueba que el GPS esté prendido y lee la
// posición actual. Devuelve { latitud, longitud, precision } con 6 decimales.
export async function obtenerUbicacion() {
  const permiso = await Location.requestForegroundPermissionsAsync()
  if (permiso.status !== 'granted') {
    const bloqueado = permiso.canAskAgain === false
    throw new ErrorUbicacion(bloqueado ? 'permiso_bloqueado' : 'permiso', MENSAJES[bloqueado ? 'permiso_bloqueado' : 'permiso'])
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new ErrorUbicacion('gps_apagado', MENSAJES.gps_apagado)
  }
  let posicion = null
  for (const { accuracy, espera } of INTENTOS) {
    try {
      posicion = await conEspera(Location.getCurrentPositionAsync({ accuracy }), espera)
      break
    } catch {
      // Sin respuesta o error del sistema: se prueba con el siguiente método
    }
  }
  if (!posicion) throw new ErrorUbicacion('sin_senal', MENSAJES.sin_senal)
  const { latitude, longitude, accuracy } = posicion?.coords ?? {}
  if (!coordenadasValidas(latitude, longitude)) {
    throw new ErrorUbicacion('invalida', MENSAJES.invalida)
  }
  const seis = (v) => Math.round(v * 1e6) / 1e6
  return { latitud: seis(latitude), longitud: seis(longitude), precision: accuracy ?? null }
}
