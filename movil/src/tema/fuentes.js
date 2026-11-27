// Tipografías del Manual de Identidad (las mismas del proyecto Consultora-Grupo7):
//  - Titulares: Montserrat.
//  - Texto: Arial. En Android Arial no viene instalada, así que se usa Arimo,
//    que tiene exactamente las mismas medidas; se usa en las dos plataformas
//    para que la app se vea igual en todos los celulares.
// Se cargan en app/_layout.jsx (useFonts) antes de dibujar la app.
//
// En React Native cada grosor de una fuente cargada es un archivo distinto,
// por eso el fontWeight se traduce al nombre de la fuente correspondiente.
// Se importa cada peso por separado para no meter en la app todas las variantes.
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular'
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium'
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold'
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold'
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold'
import { Arimo_400Regular } from '@expo-google-fonts/arimo/400Regular'
import { Arimo_700Bold } from '@expo-google-fonts/arimo/700Bold'

// Para useFonts() en app/_layout.jsx
export const ARCHIVOS_FUENTES = {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Arimo_400Regular,
  Arimo_700Bold,
}

// Nombres por uso, para poner fontFamily a mano en un estilo
export const FUENTES = {
  titulo: 'Montserrat_800ExtraBold',
  subtitulo: 'Montserrat_700Bold',
  boton: 'Montserrat_700Bold',
  semi: 'Montserrat_600SemiBold',
  texto: 'Arimo_400Regular',
  negrita: 'Arimo_700Bold',
}

const MONTSERRAT = {
  400: 'Montserrat_400Regular',
  500: 'Montserrat_500Medium',
  600: 'Montserrat_600SemiBold',
  700: 'Montserrat_700Bold',
  800: 'Montserrat_800ExtraBold',
  900: 'Montserrat_800ExtraBold',
}

const peso = (fontWeight) => parseInt(fontWeight === 'bold' ? '700' : fontWeight || '400', 10) || 400

// Fuente de un titular según el grosor (por defecto, negrita)
export const fuenteTitulo = (fontWeight = '700') => ({ fontFamily: MONTSERRAT[Math.max(400, peso(fontWeight))] })

// Fuente de texto común: Arial/Arimo solo tiene normal y negrita
export const fuenteTexto = (fontWeight = '400') => ({ fontFamily: peso(fontWeight) >= 600 ? FUENTES.negrita : FUENTES.texto })

// Le pone la fuente que corresponde a un estilo de texto ya aplanado. La usan
// <Text> y <TextInput> de src/ui (todas las pantallas).
// titulo: true / false para forzarlo; si no se indica, los textos grandes y en
// negrita (17 px o más) se consideran titulares, como en el desarrollo móvil.
// Si el estilo ya trae fontFamily, se respeta.
export function conFuente(estilo, titulo) {
  const { fontWeight, ...resto } = estilo ?? {}
  if (resto.fontFamily) return estilo
  const esTitulo = titulo ?? (peso(fontWeight) >= 700 && (resto.fontSize ?? 15) >= 17)
  return { ...resto, ...(esTitulo ? fuenteTitulo(fontWeight) : fuenteTexto(fontWeight)) }
}
