// Piezas básicas de la interfaz, con el diseño del desarrollo móvil:
// campos con ícono sobre fondo gris claro, botones violetas redondeados,
// tarjetas blancas con sombra suave, etiquetas de color y avatar con iniciales.
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text as TextoNativo, TextInput as EntradaNativa, View } from 'react-native'
import { Check, Eye, EyeOff } from 'lucide-react-native'
import { conFuente } from '../tema/fuentes'
import { MARCA, SOMBRA, useTema } from '../tema/tema'
import { inicialDe } from '../util/usuario'

// <Text> con las tipografías de la marca (Montserrat en titulares, Arial/Arimo
// en el resto). Todas las pantallas lo usan en lugar del <Text> de React Native.
// titulo: true / false para forzar la tipografía de titular.
export function Text({ style, titulo, ...resto }) {
  return <TextoNativo style={conFuente(StyleSheet.flatten(style), titulo)} {...resto} />
}

// <TextInput> con la tipografía de texto de la marca (mismo uso que el de React Native)
export function TextInput({ style, ...resto }) {
  const { c } = useTema()
  return <EntradaNativa placeholderTextColor={c.placeholder} selectionColor={MARCA.violeta} {...resto} style={conFuente(StyleSheet.flatten(style), false)} />
}

export function Texto({ estilo = 'normal', style, children, ...resto }) {
  const { c } = useTema()
  const base = {
    normal: { color: c.texto, fontSize: 15 },
    titulo: { color: c.texto, fontSize: 26, fontWeight: '800' },
    subtitulo: { color: c.texto, fontSize: 18, fontWeight: '800' },
    negrita: { color: c.texto, fontSize: 15, fontWeight: '700' },
    suave: { color: c.gris, fontSize: 14 },
    chico: { color: c.gris, fontSize: 12 },
    error: { color: c.rojoTexto, fontSize: 13 },
    ok: { color: c.verdeTexto, fontSize: 14, fontWeight: '700' },
    etiqueta: { color: c.texto, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  }[estilo]
  return (
    <Text style={[base, style]} titulo={estilo === 'titulo' || estilo === 'subtitulo' || undefined} {...resto}>
      {children}
    </Text>
  )
}

// variante: 'lleno' (violeta), 'borde', 'peligro' (borde rojo) o 'rojo' (lleno rojo)
export function Boton({ titulo, onPress, variante = 'lleno', chico, grande, disabled, cargando, icono: Icono, style, flex }) {
  const { c } = useTema()
  const colores = {
    lleno: { fondo: MARCA.violeta, texto: '#fff', borde: MARCA.violeta },
    borde: { fondo: c.superficie, texto: c.violetaTexto, borde: MARCA.violeta },
    peligro: { fondo: c.superficie, texto: c.rojoTexto, borde: c.bordeError },
    rojo: { fondo: MARCA.rojo, texto: '#fff', borde: MARCA.rojo },
  }[variante]
  const inactivo = disabled || cargando
  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      android_ripple={variante === 'lleno' || variante === 'rojo' ? { color: 'rgba(255,255,255,0.25)' } : undefined}
      style={({ pressed }) => [
        {
          height: chico ? 36 : grande ? 52 : 46,
          paddingHorizontal: chico ? 12 : 18,
          borderRadius: chico ? 10 : 12,
          borderWidth: 1.5,
          backgroundColor: colores.fondo,
          borderColor: colores.borde,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          overflow: 'hidden', // la onda de Android no se sale del borde redondeado
          opacity: inactivo ? 0.45 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        flex && { flex: 1 },
        style,
      ]}
    >
      {cargando ? <ActivityIndicator size="small" color={colores.texto} /> : Icono && <Icono size={chico ? 16 : 18} color={colores.texto} />}
      <Text style={{ color: colores.texto, fontWeight: '700', fontSize: chico ? 13.5 : grande ? 17 : 15 }} numberOfLines={1}>
        {titulo}
      </Text>
    </Pressable>
  )
}

// Botón cuadrado con solo un ícono (las acciones de cada tarjeta); la etiqueta
// queda como nombre accesible. Con mantener apretado se ve la etiqueta.
export function BotonIcono({ icono: Icono, etiqueta, onPress, variante = 'borde', disabled, ayuda }) {
  const { c } = useTema()
  const [cartel, setCartel] = useState(false)
  const color = variante === 'peligro' ? c.rojoTexto : variante === 'lleno' ? '#fff' : c.violetaTexto
  const fondo = variante === 'lleno' ? MARCA.violeta : variante === 'peligro' ? c.fondoError : c.fondo
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onLongPress={() => {
          setCartel(true)
          setTimeout(() => setCartel(false), 1500)
        }}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityHint={ayuda}
        hitSlop={4}
        style={({ pressed }) => ({
          width: 40,
          height: 40,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed && variante !== 'lleno' ? c.superficie2 : fondo,
          opacity: disabled ? 0.45 : 1,
        })}
      >
        <Icono size={18} color={color} strokeWidth={2} />
      </Pressable>
      {cartel && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 46,
            right: 0,
            backgroundColor: '#15121c',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            minWidth: 70,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12 }}>{ayuda || etiqueta}</Text>
        </View>
      )}
    </View>
  )
}

// Campo de texto con etiqueta arriba, ícono a la izquierda y error debajo
export function Entrada({ etiqueta, error, ayuda, style, multiline, contrasena, icono: Icono, onFocus, onBlur, ...resto }) {
  const { c } = useTema()
  const [foco, setFoco] = useState(false)
  const [ver, setVer] = useState(false)
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {etiqueta ? <Texto estilo="etiqueta">{etiqueta}</Texto> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          borderWidth: 1,
          borderRadius: 12,
          borderColor: error ? c.rojoTexto : foco ? MARCA.violeta : c.borde,
          backgroundColor: c.campo,
          paddingHorizontal: 16,
          minHeight: multiline ? 96 : 54,
          gap: 12,
        }}
      >
        {Icono && <Icono size={24} color={error ? c.rojoTexto : c.texto} style={multiline ? { marginTop: 14 } : undefined} />}
        <TextInput
          multiline={multiline}
          secureTextEntry={contrasena && !ver}
          {...resto}
          onFocus={(e) => {
            setFoco(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFoco(false)
            onBlur?.(e)
          }}
          style={{
            flex: 1,
            color: c.texto,
            fontSize: 16,
            paddingVertical: multiline ? 12 : 8,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {contrasena && (
          <Pressable
            onPress={() => setVer((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={10}
          >
            {ver ? <EyeOff size={24} color={c.gris} /> : <Eye size={24} color={c.gris} />}
          </Pressable>
        )}
      </View>
      {error ? (
        <Texto estilo="error" style={{ marginTop: 6 }}>
          {error}
        </Texto>
      ) : ayuda ? (
        <Texto estilo="chico" style={{ marginTop: 6 }}>
          {ayuda}
        </Texto>
      ) : null}
    </View>
  )
}

// Casilla de verificación (checkbox)
export function Casilla({ marcada, onCambio, children, disabled, style, chica }) {
  const { c } = useTema()
  return (
    <Pressable
      onPress={() => !disabled && onCambio(!marcada)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada, disabled }}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: chica ? 8 : 10, paddingVertical: 6, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View
        style={{
          width: chica ? 18 : 22,
          height: chica ? 18 : 22,
          borderRadius: chica ? 4 : 6,
          borderWidth: 1.5,
          borderColor: marcada ? MARCA.violeta : c.gris,
          backgroundColor: marcada ? MARCA.violeta : c.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {marcada && <Check size={chica ? 12 : 14} color="#fff" strokeWidth={3} />}
      </View>
      <View style={{ flexShrink: 1 }}>{typeof children === 'string' ? <Texto style={chica ? { fontSize: 14 } : null}>{children}</Texto> : children}</View>
    </Pressable>
  )
}

// Etiqueta chica de color ("Desactivada", "Superusuario"…)
export function Etiqueta({ children, color = 'gris' }) {
  const { c } = useTema()
  const colores = {
    gris: [c.oscuro ? c.superficie2 : '#F1F2F5', c.gris],
    violeta: [c.superficie2, c.violetaTexto],
    magenta: [c.fondoMagenta, c.magentaTexto],
    verde: [c.fondoOk, c.verdeTexto],
    rojo: [c.fondoError, c.rojoTexto],
    celeste: [c.oscuro ? '#163444' : '#e6f6fd', c.azulTexto],
    naranja: [c.oscuro ? '#3a2c14' : '#fff4e2', c.ambarTexto],
  }[color]
  return (
    <View style={{ backgroundColor: colores[0], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' }}>
      <Text style={{ color: colores[1], fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </View>
  )
}

// Estilo de tarjeta del desarrollo móvil: blanca, redondeada y con sombra
// suave (en modo oscuro la sombra no se ve, así que lleva borde). Lo usan
// Tarjeta y las filas de los listados que arman su propio contenedor.
export const estiloTarjeta = (c) => ({
  backgroundColor: c.superficie,
  borderRadius: 18,
  ...(c.oscuro ? { borderWidth: 1, borderColor: c.linea } : SOMBRA),
})

export function Tarjeta({ children, style, apagada, ...resto }) {
  const { c } = useTema()
  return (
    <View
      style={[estiloTarjeta(c), { padding: 16, opacity: apagada ? 0.7 : 1 }, style]}
      {...resto}
    >
      {children}
    </View>
  )
}

// Las cuatro franjas de color de la campaña
export function Franja({ ancho = 64, alto = 4, style }) {
  return (
    <View style={[{ flexDirection: 'row', width: ancho, height: alto, borderRadius: 2, overflow: 'hidden' }, style]}>
      {[MARCA.violeta, MARCA.celeste, MARCA.magenta, MARCA.naranja].map((color) => (
        <View key={color} style={{ flex: 1, backgroundColor: color }} />
      ))}
    </View>
  )
}

export function VacioTarjeta({ titulo, children }) {
  const { c } = useTema()
  return (
    <View
      style={{
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.borde,
        borderRadius: 18,
        paddingVertical: 36,
        paddingHorizontal: 16,
        alignItems: 'center',
        gap: 4,
      }}
    >
      {titulo ? (
        <Texto estilo="negrita" style={{ textAlign: 'center', color: c.gris }}>
          {titulo}
        </Texto>
      ) : null}
      {children ? (
        <Texto estilo="suave" style={{ textAlign: 'center', lineHeight: 21 }}>
          {children}
        </Texto>
      ) : null}
    </View>
  )
}

// Error general de un formulario: caja rosada con el texto en rojo
export function TextoError({ children, style }) {
  const { c } = useTema()
  if (!children) return null
  return (
    <View
      accessibilityRole="alert"
      style={[{ backgroundColor: c.fondoError, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginVertical: 6 }, style]}
    >
      <Text style={{ color: c.rojoTexto, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  )
}

// Círculo del usuario: su foto de perfil o, si no cargó una (o no se pudo
// mostrar), su inicial sobre magenta
export function Avatar({ usuario, tamano = 40, borde }) {
  const { c } = useTema()
  const [fallo, setFallo] = useState(false)
  useEffect(() => setFallo(false), [usuario.foto])
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Foto de perfil"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: usuario.activo === false ? c.placeholder : MARCA.magenta,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: tamano >= 64 ? 3 : tamano >= 40 ? 2 : 1,
        borderColor: borde ?? '#fff',
      }}
    >
      {usuario.foto && !fallo ? (
        <Image source={{ uri: usuario.foto }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFallo(true)} />
      ) : (
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: tamano * 0.38 }} titulo>
          {inicialDe(usuario)}
        </Text>
      )}
    </View>
  )
}

// Fila: elementos uno al lado del otro
export const Fila = ({ children, style, gap = 8, envolver }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: envolver ? 'wrap' : 'nowrap' }, style]}>
    {children}
  </View>
)
