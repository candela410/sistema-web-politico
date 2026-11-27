// Ventanas: modal con el aspecto de la campaña, confirmación, selector
// (reemplaza a <select>) y elegir fecha (reemplaza a <input type="date">).
import { useState } from 'react'
import { KeyboardAvoidingView, Modal as RNModal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Calendar, Check, ChevronDown, X } from 'lucide-react-native'
import { MARCA, useTema } from '../tema/tema'
import { Boton, Fila, Texto, Text } from './base'

// Ventana modal. El fondo y el botón "atrás" de Android la cierran.
// ancho: true para ventanas grandes (formularios largos).
export function Modal({ titulo, children, onCerrar, ancho, pie }) {
  const { c } = useTema()
  const { width, height } = useWindowDimensions()
  return (
    <RNModal transparent animationType="fade" visible onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.velo }}
            onPress={onCerrar}
            accessibilityLabel="Cerrar"
          />
          <View
            accessibilityViewIsModal
            style={{
              width: '100%',
              maxWidth: ancho ? Math.min(760, width - 24) : 480,
              maxHeight: height * 0.9,
              backgroundColor: c.superficie,
              borderRadius: 24,
              overflow: 'hidden',
            }}
          >
            <View style={{ height: 5, flexDirection: 'row', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
              {[MARCA.violeta, MARCA.celeste, MARCA.magenta, MARCA.naranja].map((col) => (
                <View key={col} style={{ flex: 1, backgroundColor: col }} />
              ))}
            </View>
            <Fila style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, justifyContent: 'space-between' }}>
              <Texto estilo="subtitulo" accessibilityRole="header" style={{ flex: 1 }}>
                {titulo}
              </Texto>
              <Pressable onPress={onCerrar} hitSlop={10} accessibilityLabel="Cerrar ventana">
                <X size={22} color={c.gris} />
              </Pressable>
            </Fila>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: pie ? 8 : 20 }}
            >
              {children}
            </ScrollView>
            {pie ? <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 6 }}>{pie}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  )
}

// Botones Cancelar / Confirmar al pie de los formularios
export function Acciones({ onCancelar, textoCancelar = 'Cancelar', children }) {
  return (
    <Fila style={{ justifyContent: 'flex-end', marginTop: 12 }} envolver>
      {onCancelar && <Boton titulo={textoCancelar} variante="borde" onPress={onCancelar} />}
      {children}
    </Fila>
  )
}

// Ventana para confirmar una acción ("¿Desea desactivar…?").
// onConfirmar puede ser async: mientras corre, el botón muestra un spinner.
export function Confirmacion({ titulo, children, textoConfirmar = 'Confirmar', peligro = true, onConfirmar, onCerrar, error }) {
  const [trabajando, setTrabajando] = useState(false)
  async function confirmar() {
    setTrabajando(true)
    try {
      await onConfirmar()
    } finally {
      setTrabajando(false)
    }
  }
  return (
    <Modal titulo={titulo} onCerrar={trabajando ? () => {} : onCerrar}>
      {typeof children === 'string' ? <Texto style={{ lineHeight: 22 }}>{children}</Texto> : children}
      {error ? (
        <Texto estilo="error" style={{ marginTop: 8 }}>
          {error}
        </Texto>
      ) : null}
      <Acciones onCancelar={trabajando ? null : onCerrar}>
        <Boton
          titulo={trabajando ? `${textoConfirmar}…` : textoConfirmar}
          variante={peligro ? 'rojo' : 'lleno'}
          onPress={confirmar}
          cargando={trabajando}
        />
      </Acciones>
    </Modal>
  )
}

// Reemplazo de <select>: muestra el valor elegido y abre una lista.
// opciones: [{ valor, texto, deshabilitada? }]
export function Selector({ etiqueta, valor, opciones, onCambio, placeholder = 'Seleccione…', disabled, style, error }) {
  const { c } = useTema()
  const [abierto, setAbierto] = useState(false)
  const elegida = opciones.find((o) => String(o.valor) === String(valor))
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {etiqueta ? <Texto estilo="etiqueta">{etiqueta}</Texto> : null}
      <Pressable
        onPress={() => setAbierto(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta ?? 'Elegir'}: ${elegida?.texto ?? placeholder}`}
        style={{
          minHeight: 52,
          borderWidth: 1,
          borderRadius: 12,
          borderColor: error ? c.rojoTexto : c.borde,
          backgroundColor: error ? c.fondoError : c.campo,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <Text style={{ flex: 1, color: elegida ? c.texto : c.placeholder, fontSize: 16 }} numberOfLines={1}>
          {elegida?.texto ?? placeholder}
        </Text>
        <ChevronDown size={18} color={c.gris} />
      </Pressable>
      {error ? (
        <Texto estilo="error" style={{ marginTop: 4, fontSize: 13 }}>
          {error}
        </Texto>
      ) : null}
      {abierto && (
        <Modal titulo={etiqueta ?? placeholder} onCerrar={() => setAbierto(false)}>
          {opciones.map((o) => {
            const marcada = String(o.valor) === String(valor)
            return (
              <Pressable
                key={String(o.valor)}
                disabled={o.deshabilitada}
                onPress={() => {
                  setAbierto(false)
                  onCambio(o.valor)
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 13,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: marcada ? c.superficie2 : pressed ? c.superficie2 : 'transparent',
                  opacity: o.deshabilitada ? 0.45 : 1,
                })}
              >
                <Text style={{ flex: 1, color: c.texto, fontSize: 15.5, fontWeight: marcada ? '700' : '400' }}>{o.texto}</Text>
                {marcada && <Check size={18} color={c.violetaTexto} />}
              </Pressable>
            )
          })}
        </Modal>
      )}
    </View>
  )
}

// Fecha local como AAAA-MM-DD (toISOString la pasaría a UTC y podría cambiar de día)
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const deIso = (texto) => {
  const [a, m, d] = String(texto).split('-').map(Number)
  return a ? new Date(a, m - 1, d) : new Date()
}

// Reemplazo de <input type="date">: valor y onCambio usan 'AAAA-MM-DD' ('' = sin fecha)
export function SelectorFecha({ etiqueta, valor, onCambio, minimo, maximo, style, limpiable = true }) {
  const { c } = useTema()
  const [abierto, setAbierto] = useState(false)
  const texto = valor ? deIso(valor).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha'
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {etiqueta ? <Texto estilo="etiqueta">{etiqueta}</Texto> : null}
      <Fila gap={6}>
        <Pressable
          onPress={() => setAbierto(true)}
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta ?? 'Fecha'}: ${texto}`}
          style={{
            flex: 1,
            height: 52,
            borderWidth: 1,
            borderRadius: 12,
            borderColor: c.borde,
            backgroundColor: c.campo,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={17} color={c.gris} />
          <Text style={{ color: valor ? c.texto : c.placeholder, fontSize: 16 }}>{texto}</Text>
        </Pressable>
        {limpiable && valor ? (
          <Pressable onPress={() => onCambio('')} hitSlop={8} accessibilityLabel="Quitar fecha">
            <X size={18} color={c.gris} />
          </Pressable>
        ) : null}
      </Fila>
      {abierto && (
        <DateTimePicker
          value={valor ? deIso(valor) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimo ? deIso(minimo) : undefined}
          maximumDate={maximo ? deIso(maximo) : undefined}
          onChange={(evento, fecha) => {
            setAbierto(Platform.OS === 'ios' && evento.type !== 'set' ? true : false)
            if (evento.type === 'set' && fecha) onCambio(isoLocal(fecha))
            if (evento.type === 'dismissed') setAbierto(false)
          }}
        />
      )}
    </View>
  )
}
