// Foto de perfil: se elige de la galería (o con la cámara), se recorta cuadrada,
// se achica a 256 px y se convierte a JPEG. Así pesa unos 15-25 KB.
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

const LADO = 256

export async function elegirFotoCuadrada(conCamara = false) {
  const permiso = conCamara ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permiso.granted) throw new Error(conCamara ? 'Se necesita permiso para usar la cámara.' : 'Se necesita permiso para acceder a sus fotos.')
  const opciones = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 }
  const r = conCamara ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones)
  if (r.canceled || !r.assets?.length) return null
  const img = r.assets[0]
  const lado = Math.min(img.width, img.height)
  const acciones = []
  // Por si el sistema no recortó: recorte cuadrado desde el centro
  if (img.width !== img.height) acciones.push({ crop: { originX: (img.width - lado) / 2, originY: (img.height - lado) / 2, width: lado, height: lado } })
  acciones.push({ resize: { width: LADO, height: LADO } })
  const final = await ImageManipulator.manipulateAsync(img.uri, acciones, { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true })
  return `data:image/jpeg;base64,${final.base64}`
}
