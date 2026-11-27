// Informes PDF. En la web se dibujaban con jsPDF; en el celular se arma una
// página HTML con el mismo diseño (encabezado violeta, tablas de datos,
// recuadros, gráficos y explicaciones) y expo-print la convierte en PDF.
// Después se abre el menú de compartir (guardar en Archivos, enviar por WhatsApp…).
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

// Títulos de las dos explicaciones debajo de cada gráfico (Dashboard y estadísticas)
export const TITULOS_EXPLICACION = ['Cómo leer este gráfico', 'Qué muestran los datos']

export const esc = (texto) =>
  String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

let logoCache = null
export async function logoBase64() {
  if (logoCache) return logoCache
  try {
    const asset = Asset.fromModule(require('../../assets/img/logo.png'))
    await asset.downloadAsync()
    const datos = await FileSystem.readAsStringAsync(asset.localUri ?? asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    logoCache = `data:image/png;base64,${datos}`
  } catch {
    logoCache = ''
  }
  return logoCache
}

export const ESTILOS = `
  @page { size: A4; margin: 16mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #15121c; font-size: 10pt; margin: 0; }
  .franja { height: 4px; background: #51318f; margin-bottom: 10px; }
  .cabecera { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dedce6; padding-bottom: 8px; margin-bottom: 14px; }
  .cabecera img { height: 46px; }
  .cabecera .der { text-align: right; font-size: 8pt; color: #5d5a66; line-height: 1.5; }
  .cabecera .der b { color: #51318f; letter-spacing: .5px; }
  .gris { color: #5d5a66; }
  h1 { font-size: 20pt; margin: 2px 0 6px; }
  h2 { font-size: 12pt; color: #51318f; text-transform: uppercase; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #dedce6; }
  table.datos { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.datos th, table.datos td { border: 1px solid #dedce6; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 9.5pt; }
  table.datos th { background: #f7f6fa; color: #5d5a66; width: 34%; }
  .indicadores { display: flex; gap: 8px; margin-bottom: 8px; }
  .indicador { flex: 1; background: #f7f6fa; border: 1px solid #dedce6; border-left: 4px solid #51318f; border-radius: 6px; padding: 8px 10px; }
  .indicador b { display: block; font-size: 15pt; }
  .indicador span { font-size: 8pt; color: #5d5a66; }
  .salto { page-break-before: always; }
  .pregunta { page-break-inside: avoid; margin-bottom: 18px; }
  .pregunta .num { display: inline-block; background: #51318f; color: #fff; border-radius: 4px; width: 22px; height: 22px; text-align: center; line-height: 22px; font-weight: bold; margin-right: 6px; }
  .pregunta .de { font-size: 7.5pt; color: #8c8994; font-weight: bold; }
  .pregunta h3 { font-size: 11.5pt; margin: 4px 0 8px; }
  .ficha { display: flex; background: #f7f6fa; border: 1px solid #dedce6; margin-bottom: 8px; }
  .ficha div { flex: 1; padding: 5px 8px; border-left: 1px solid #dedce6; }
  .ficha div:first-child { border-left: 0; }
  .ficha small { display: block; font-size: 6.5pt; color: #8c8994; text-transform: uppercase; }
  .ficha b { font-size: 8.5pt; }
  .grafico { border: 1px solid #dedce6; padding: 6px; text-align: center; margin: 4px 0 8px; }
  .grafico img { max-width: 100%; max-height: 120mm; }
  .titulo-grafico { font-size: 8.5pt; color: #5d5a66; font-weight: bold; }
  .explicacion { background: #f7f6fa; border: 1px solid #dedce6; border-left: 4px solid #51318f; border-radius: 4px; padding: 6px 10px; }
  .explicacion small { display: block; color: #51318f; font-weight: bold; font-size: 7.5pt; text-transform: uppercase; margin-top: 4px; }
  .explicacion p { margin: 2px 0 4px; font-size: 9pt; }
  table.frec { width: 100%; border-collapse: collapse; }
  table.frec th, table.frec td { border: 1px solid #dedce6; padding: 4px 6px; font-size: 9pt; text-align: right; }
  table.frec th:first-child, table.frec td:first-child { text-align: left; }
  table.frec thead th, table.frec tfoot th, table.frec tfoot td { background: #f7f6fa; }
  .medidas { display: flex; flex-wrap: wrap; gap: 6px; }
  .medidas div { flex: 1 1 28%; background: #f7f6fa; border: 1px solid #dedce6; border-radius: 4px; padding: 6px; text-align: left; }
  .medidas b { display: block; font-size: 12pt; }
  .medidas span { font-size: 8pt; color: #5d5a66; }
  .pie { margin-top: 20px; font-size: 7.5pt; color: #8c8994; text-align: center; }
`

// Convierte el HTML en PDF y abre "Compartir". archivo: nombre sugerido (sin carpeta)
export async function compartirPdf(html, archivo) {
  const { uri } = await Print.printToFileAsync({ html, base64: false })
  let destino = uri
  try {
    destino = `${FileSystem.cacheDirectory}${archivo}`
    await FileSystem.deleteAsync(destino, { idempotent: true })
    await FileSystem.moveAsync({ from: uri, to: destino })
  } catch {
    destino = uri
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destino, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: archivo })
  } else {
    await Print.printAsync({ uri: destino })
  }
}
