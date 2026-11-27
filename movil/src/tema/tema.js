// Modo claro / oscuro y colores de la campaña. La paleta es la del desarrollo
// móvil (styles/colors.js del Manual de Identidad).
// La elección del modo se recuerda en el celular (AsyncStorage).
import { createContext, useContext, useMemo, useState } from 'react'
import { guardar, leer } from '../util/almacen'

export const MARCA = {
  violeta: '#53368F', // color principal: botones, barra superior, menú, links
  violetaOscuro: '#41267a',
  celeste: '#35B6E8',
  magenta: '#D6247F',
  naranja: '#FDB03F',
  rojo: '#DC2626',
  verde: '#12B76A',
  violetaClaro: '#ded4f5', // textos secundarios sobre el violeta
}

// Sombra suave de las tarjetas (iOS: shadow*, Android: elevation)
export const SOMBRA = {
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
}

const CLARO = {
  oscuro: false,
  fondo: '#f7f7fb',
  superficie: '#ffffff',
  superficie2: '#EEEAF6',
  campo: '#F9FAFC', // fondo de los campos de texto
  texto: '#111111',
  gris: '#6B7280',
  placeholder: '#9CA3AF',
  borde: '#D9DCE5',
  linea: '#eeeaf5',
  violetaTexto: MARCA.violeta,
  magentaTexto: '#B81E6C',
  rojoTexto: MARCA.rojo,
  verdeTexto: '#0E8A52',
  azulTexto: '#137fb0',
  ambarTexto: '#a76508',
  fondoError: '#FEF2F2',
  bordeError: '#F3B4B4',
  fondoOk: '#E7F8F0',
  bordeOk: '#A6E4C6',
  fondoMagenta: '#fbeef6',
  velo: 'rgba(20,12,40,0.5)',
}

const OSCURO = {
  oscuro: true,
  fondo: '#15121d',
  superficie: '#1f1b2b',
  superficie2: '#2a2539',
  campo: '#241f33',
  texto: '#ece9f5',
  gris: '#aaa5ba',
  placeholder: '#7d7891',
  borde: '#3b3450',
  linea: '#332c45',
  violetaTexto: '#c4b2f8',
  magentaTexto: '#f29bd0',
  rojoTexto: '#ff95a1',
  verdeTexto: '#6dd9ad',
  azulTexto: '#7fd0f0',
  ambarTexto: '#f5c676',
  fondoError: '#3a1c25',
  bordeError: '#7a3340',
  fondoOk: '#173428',
  bordeOk: '#2c6a50',
  fondoMagenta: '#3a1c33',
  velo: 'rgba(0,0,0,0.6)',
}

export const ContextoTema = createContext({ c: { ...CLARO, ...MARCA }, claro: { ...CLARO, ...MARCA }, tema: 'claro', alternar: () => {} })

export function ProveedorTema({ children }) {
  const [tema, setTema] = useState(() => (leer('tema') === 'oscuro' ? 'oscuro' : 'claro'))
  const valor = useMemo(
    () => ({
      tema,
      c: { ...(tema === 'oscuro' ? OSCURO : CLARO), ...MARCA },
      claro: { ...CLARO, ...MARCA },
      alternar: () =>
        setTema((t) => {
          const nuevo = t === 'oscuro' ? 'claro' : 'oscuro'
          guardar('tema', nuevo)
          return nuevo
        }),
    }),
    [tema],
  )
  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>
}

// const { c } = useTema()  → colores del modo actual
export const useTema = () => useContext(ContextoTema)

// Estilos que dependen del tema, memorizados: const s = useEstilos(crear)
export function useEstilos(crear) {
  const { c } = useTema()
  return useMemo(() => crear(c), [c, crear])
}
