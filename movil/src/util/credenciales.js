// "Recordar" del login: guarda el nombre de usuario y la contraseña en el
// almacenamiento seguro del celular (Keychain en iPhone, Keystore en Android),
// cifrados por el sistema. No se guardan en AsyncStorage ni en texto plano.
// Sin "Recordar" se borran.
import * as SecureStore from 'expo-secure-store'

const CLAVE = 'credenciales-login'

export async function guardarCredenciales(usuario, password) {
  try {
    await SecureStore.setItemAsync(CLAVE, JSON.stringify({ usuario, password }))
  } catch {
    // Sin almacenamiento seguro (por ejemplo, en la web): no se recuerdan
  }
}

export async function leerCredenciales() {
  try {
    const guardadas = await SecureStore.getItemAsync(CLAVE)
    const { usuario, password } = guardadas ? JSON.parse(guardadas) : {}
    return usuario && password ? { usuario, password } : null
  } catch {
    return null
  }
}

export async function borrarCredenciales() {
  try {
    await SecureStore.deleteItemAsync(CLAVE)
  } catch {
    // nada que borrar
  }
}
