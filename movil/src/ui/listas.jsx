// Piezas de las pantallas de listado: página con scroll, encabezado,
// buscador, paginación, esqueleto de carga, aviso de "listo" e interruptor.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native'
import { MARCA, SOMBRA, useTema } from '../tema/tema'
import { Boton, Fila, Franja, Texto, Text, TextInput } from './base'
import { Confirmacion } from './ventanas'

const ContextoPagina = createContext({ arriba: () => {} })

// Contenedor con scroll de cada pantalla (la clase .pagina de la web)
export function Pagina({ children, alRefrescar, sinScroll, style }) {
  const { c } = useTema()
  const ref = useRef(null)
  const [refrescando, setRefrescando] = useState(false)
  if (sinScroll) return <View style={[{ flex: 1, backgroundColor: c.fondo }, style]}>{children}</View>
  return (
    <ContextoPagina.Provider value={{ arriba: () => ref.current?.scrollTo({ y: 0, animated: true }) }}>
      <ScrollView
        ref={ref}
        style={{ flex: 1, backgroundColor: c.fondo }}
        contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 900, alignSelf: 'center' }, style]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          alRefrescar ? (
            <RefreshControl
              refreshing={refrescando}
              tintColor={MARCA.violeta}
              colors={[MARCA.violeta]}
              onRefresh={async () => {
                setRefrescando(true)
                try {
                  await alRefrescar()
                } finally {
                  setRefrescando(false)
                }
              }}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </ContextoPagina.Provider>
  )
}

// Título, descripción, franja de colores y el botón principal ("+ Nueva…")
export function Encabezado({ titulo, descripcion, accion, onAccion, children }) {
  return (
    <View style={{ gap: 10 }}>
      <View>
        <Texto estilo="titulo" accessibilityRole="header">
          {titulo}
        </Texto>
        {descripcion ? (
          <Texto estilo="suave" style={{ marginTop: 4, marginBottom: 10 }}>
            {descripcion}
          </Texto>
        ) : null}
        <Franja />
      </View>
      {accion ? <Boton titulo={accion} onPress={onAccion} grande /> : null}
      {children}
    </View>
  )
}

// Buscador de los listados, con la X para limpiar
export function Buscador({ valor, onCambio, placeholder, etiqueta }) {
  const { c } = useTema()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 50,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.linea,
        backgroundColor: c.superficie,
        ...(c.oscuro ? null : SOMBRA),
      }}
    >
      <Search size={19} color={c.gris} />
      <TextInput
        style={{ flex: 1, color: c.texto, fontSize: 15.5 }}
        placeholder={placeholder}
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={onCambio}
        autoCorrect={false}
        returnKeyType="search"
        maxLength={100}
      />
      {valor ? (
        <Pressable onPress={() => onCambio('')} hitSlop={8} accessibilityLabel="Limpiar búsqueda">
          <X size={18} color={c.gris} />
        </Pressable>
      ) : null}
    </View>
  )
}

// Paginación de todos los listados: de a POR_PAGINA registros
export const POR_PAGINA = 15

export function usePaginado(lista, porPagina = POR_PAGINA) {
  const [pagina, setPagina] = useState(1)
  const [largo, setLargo] = useState(lista.length)
  // Si la lista cambia de tamaño (búsqueda, filtros, altas o bajas) se vuelve a la primera página
  if (largo !== lista.length) {
    setLargo(lista.length)
    setPagina(1)
  }
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina))
  const actual = Math.min(pagina, paginas)
  return {
    items: lista.slice((actual - 1) * porPagina, actual * porPagina),
    pagina: actual,
    paginas,
    total: lista.length,
    porPagina,
    irA: setPagina,
  }
}

function numeros(pagina, paginas) {
  const lista = []
  for (let n = 1; n <= paginas; n++) {
    if (n === 1 || n === paginas || Math.abs(n - pagina) <= 1) lista.push(n)
    else if (lista[lista.length - 1] !== '…') lista.push('…')
  }
  return lista
}

export function Paginacion({ pagina, paginas, total, porPagina = POR_PAGINA, irA }) {
  const { c } = useTema()
  const { arriba } = useContext(ContextoPagina)
  if (paginas <= 1) return null
  const desde = (pagina - 1) * porPagina + 1
  const hasta = Math.min(pagina * porPagina, total)
  const ir = (n) => {
    irA(n)
    arriba()
  }
  const caja = (activa) => ({
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: activa ? MARCA.violeta : c.borde,
    backgroundColor: activa ? MARCA.violeta : c.superficie,
    paddingHorizontal: 6,
  })
  return (
    <View style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
      <Texto estilo="chico">
        Mostrando {desde}–{hasta} de {total.toLocaleString('es-AR')}
      </Texto>
      <Fila gap={6} envolver style={{ justifyContent: 'center' }}>
        <Pressable style={[caja(false), { opacity: pagina <= 1 ? 0.4 : 1 }]} disabled={pagina <= 1} onPress={() => ir(pagina - 1)} accessibilityLabel="Página anterior">
          <ChevronLeft size={17} color={c.texto} />
        </Pressable>
        {numeros(pagina, paginas).map((n, i) =>
          n === '…' ? (
            <Text key={`s${i}`} style={{ color: c.gris }}>
              …
            </Text>
          ) : (
            <Pressable key={n} style={caja(n === pagina)} onPress={() => n !== pagina && ir(n)} accessibilityLabel={`Página ${n}`}>
              <Text style={{ color: n === pagina ? '#fff' : c.texto, fontWeight: '700' }}>{n}</Text>
            </Pressable>
          ),
        )}
        <Pressable
          style={[caja(false), { opacity: pagina >= paginas ? 0.4 : 1 }]}
          disabled={pagina >= paginas}
          onPress={() => ir(pagina + 1)}
          accessibilityLabel="Página siguiente"
        >
          <ChevronRight size={17} color={c.texto} />
        </Pressable>
      </Fila>
    </View>
  )
}

// Tarjetas "fantasma" con la forma de una fila mientras llegan los datos
export function Esqueleto({ filas = 3 }) {
  const { c } = useTema()
  const brillo = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(brillo, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(brillo, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [brillo])
  const barra = (ancho, alto = 12) => (
    <View style={{ width: ancho, height: alto, borderRadius: 6, backgroundColor: c.superficie2 }} />
  )
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Cargando…" style={{ gap: 10 }}>
      {Array.from({ length: filas }, (_, i) => (
        <Animated.View
          key={i}
          style={{
            opacity: brillo,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 16,
            borderRadius: 18,
            backgroundColor: c.superficie,
            ...(c.oscuro ? { borderWidth: 1, borderColor: c.linea } : SOMBRA),
          }}
        >
          <View style={{ flex: 1, gap: 8 }}>
            {barra('30%', 10)}
            {barra('60%', 16)}
            {barra('45%', 10)}
          </View>
          {barra(40, 40)}
          {barra(40, 40)}
        </Animated.View>
      ))}
    </View>
  )
}

// Mensaje de "listo" ("El usuario fue creado"…): aparece y se desvanece
export function AvisoOk({ children }) {
  const { c } = useTema()
  const opacidad = useRef(new Animated.Value(0)).current
  const [ultimo, setUltimo] = useState(children)
  if (children && children !== ultimo) setUltimo(children)
  useEffect(() => {
    Animated.timing(opacidad, { toValue: children ? 1 : 0, duration: 220, useNativeDriver: true }).start()
  }, [children, opacidad])
  if (!ultimo) return null
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        opacity: opacidad,
        backgroundColor: c.fondoOk,
        borderColor: c.bordeOk,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        display: children ? 'flex' : 'none',
      }}
    >
      <Texto estilo="ok">✓ {children || ultimo}</Texto>
    </Animated.View>
  )
}

// Hook para los avisos de "listo": avisar('texto') lo muestra unos segundos
export function useAviso(duracion = 4000) {
  const [aviso, setAviso] = useState('')
  const reloj = useRef(null)
  useEffect(() => () => clearTimeout(reloj.current), [])
  const avisar = (texto) => {
    clearTimeout(reloj.current)
    setAviso(texto)
    reloj.current = setTimeout(() => setAviso(''), duracion)
  }
  return [aviso, avisar]
}

// Interruptor para activar/desactivar desde una lista. Cambia al instante;
// si el pedido falla vuelve a su lugar. Con `confirmacion` ({ titulo, mensaje })
// pregunta antes de DESACTIVAR.
export function Interruptor({ activo, onCambiar, etiqueta, confirmacion, textos = ['Activo', 'Inactivo'] }) {
  const { c } = useTema()
  const [pendiente, setPendiente] = useState(null)
  const [preguntando, setPreguntando] = useState(false)
  const valor = pendiente ?? activo

  async function aplicar(nuevo) {
    setPendiente(nuevo)
    try {
      await onCambiar(nuevo)
    } finally {
      setPendiente(null)
    }
  }

  function cambiar() {
    if (pendiente !== null) return
    const nuevo = !valor
    if (!nuevo && confirmacion) {
      setPreguntando(true)
      return
    }
    aplicar(nuevo)
  }

  return (
    <>
      <Fila gap={4}>
        <Switch
          value={valor}
          onValueChange={cambiar}
          accessibilityLabel={etiqueta}
          trackColor={{ true: MARCA.violeta, false: c.borde }}
          thumbColor="#fff"
          ios_backgroundColor={c.borde}
        />
        <Texto estilo="chico" style={{ fontWeight: '700', color: valor ? c.violetaTexto : c.gris }}>
          {valor ? textos[0] : textos[1]}
        </Texto>
      </Fila>
      {preguntando && (
        <Confirmacion
          titulo={confirmacion.titulo}
          textoConfirmar="Desactivar"
          onCerrar={() => setPreguntando(false)}
          onConfirmar={() => {
            setPreguntando(false)
            return aplicar(false)
          }}
        >
          {confirmacion.mensaje}
        </Confirmacion>
      )}
    </>
  )
}

// Interruptor simple con texto (dentro de formularios)
export function InterruptorCampo({ valor, onCambio, children, disabled }) {
  const { c } = useTema()
  return (
    <Fila style={{ marginBottom: 12, opacity: disabled ? 0.5 : 1 }} gap={10}>
      <Switch
        value={valor}
        onValueChange={onCambio}
        disabled={disabled}
        trackColor={{ true: MARCA.violeta, false: c.borde }}
        thumbColor="#fff"
        ios_backgroundColor={c.borde}
      />
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Texto>{children}</Texto> : children}</View>
    </Fila>
  )
}

// Mensaje a pantalla completa (sin campaña, sin permisos…)
export function Aviso({ titulo, children }) {
  const { c } = useTema()
  return (
    <View style={{ flex: 1, backgroundColor: c.fondo, padding: 16, justifyContent: 'center' }}>
      <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.borde, borderRadius: 18, padding: 28, gap: 6, alignItems: 'center' }}>
        <Texto estilo="negrita" style={{ textAlign: 'center' }}>
          {titulo}
        </Texto>
        <Texto estilo="suave" style={{ textAlign: 'center' }}>
          {children}
        </Texto>
      </View>
    </View>
  )
}
