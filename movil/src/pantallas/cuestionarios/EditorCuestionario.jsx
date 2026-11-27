import { useEffect, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { router, useNavigation } from 'expo-router'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Trash2, X } from 'lucide-react-native'
import { obtenerCategorias } from '../../api/categorias'
import * as api from '../../api/cuestionarios'
import { MARCA, useTema } from '../../tema/tema'
import { Boton, Fila, InterruptorCampo, Selector, Texto, VacioTarjeta, Text, TextInput, estiloTarjeta } from '../../ui'
import { dejarAviso } from '../../util/avisoPendiente'
import { variableDe } from './variable'

// Editor de cuestionarios al estilo Google Forms: una tarjeta para el título
// y una tarjeta por pregunta, con sus opciones.
const MAX_PREGUNTAS = 15 // el backend controla lo mismo

let siguienteClave = 1
const clave = () => `c${siguienteClave++}`
const nuevaOpcion = (texto = '') => ({ clave: clave(), texto })
const nuevaPregunta = () => ({ clave: clave(), enunciado: '', tipo: 'una_opcion', obligatoria: false, opciones: [nuevaOpcion(), nuevaOpcion()] })

function desdeServidor(c) {
  return {
    titulo: c.titulo,
    descripcion: c.descripcion,
    categoria: c.categoria,
    activo: c.activo,
    preguntas: c.preguntas.map((p) => ({
      clave: clave(),
      enunciado: p.enunciado,
      tipo: 'una_opcion',
      obligatoria: p.obligatoria,
      opciones: p.opciones.map((o) => nuevaOpcion(o.texto)),
    })),
  }
}

function paraServidor(f) {
  return {
    titulo: f.titulo,
    descripcion: f.descripcion,
    categoria: f.categoria ? Number(f.categoria) : null,
    activo: f.activo,
    preguntas: f.preguntas.map((p) => ({
      enunciado: p.enunciado,
      tipo: p.tipo,
      obligatoria: p.obligatoria,
      opciones: p.opciones.map((o) => ({ texto: o.texto })),
    })),
  }
}

function Herramienta({ icono: Icono, etiqueta, onPress, disabled, peligro }) {
  const { c } = useTema()
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={etiqueta} hitSlop={4} style={{ padding: 8, opacity: disabled ? 0.3 : 1 }}>
      <Icono size={20} color={peligro ? c.rojoTexto : c.gris} />
    </Pressable>
  )
}

function TarjetaPregunta({ pregunta, numero, total, activa, bloqueado, onActivar, onCambio, onMover, onDuplicar, onBorrar }) {
  const { c } = useTema()
  const refsOpciones = useRef({})
  const [enfocar, setEnfocar] = useState(null)

  useEffect(() => {
    if (enfocar && refsOpciones.current[enfocar]) {
      refsOpciones.current[enfocar].focus()
      setEnfocar(null)
    }
  }, [enfocar, pregunta.opciones])

  const cambiar = (campos) => onCambio({ ...pregunta, ...campos })
  const cambiarOpcion = (k, texto) => cambiar({ opciones: pregunta.opciones.map((o) => (o.clave === k ? { ...o, texto } : o)) })
  const quitarOpcion = (k) => cambiar({ opciones: pregunta.opciones.filter((o) => o.clave !== k) })

  function agregarOpcion(despuesDe) {
    const opcion = nuevaOpcion()
    const i = despuesDe ? pregunta.opciones.findIndex((o) => o.clave === despuesDe) + 1 : pregunta.opciones.length
    cambiar({ opciones: [...pregunta.opciones.slice(0, i), opcion, ...pregunta.opciones.slice(i)] })
    setEnfocar(opcion.clave)
  }

  const variable = variableDe(pregunta.opciones)
  const linea = { color: c.texto, fontSize: 15.5, borderBottomWidth: 1.5, borderColor: c.borde, paddingVertical: 6, flex: 1 }

  return (
    <Pressable
      onPress={onActivar}
      accessibilityLabel={`Pregunta ${numero}`}
      style={{
        backgroundColor: c.superficie,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: c.linea,
        borderLeftWidth: 5,
        borderLeftColor: activa ? MARCA.celeste : c.linea,
        padding: 14,
        gap: 10,
      }}
    >
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: variable === 'cuantitativa' ? (c.oscuro ? '#163444' : '#e6f6fd') : c.fondoMagenta,
        }}
      >
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: variable === 'cuantitativa' ? c.azulTexto : c.magentaTexto }}>
          {variable === 'cuantitativa' ? 'Cuantitativa' : 'Cualitativa'}
        </Text>
      </View>
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: MARCA.violeta, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{numero}</Text>
        </View>
        <TextInput
          style={[linea, { fontWeight: '600', fontSize: 16.5 }]}
          multiline
          value={pregunta.enunciado}
          onChangeText={(t) => cambiar({ enunciado: t })}
          onFocus={onActivar}
          placeholder="Escriba la pregunta"
          accessibilityLabel={`Texto de la pregunta ${numero}`}
          editable={!bloqueado}
        />
      </Fila>
      {pregunta.opciones.map((o, i) => (
        <Fila key={o.clave} gap={10}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.borde }} />
          <TextInput
            ref={(el) => (refsOpciones.current[o.clave] = el)}
            style={linea}
            value={o.texto}
            onChangeText={(t) => cambiarOpcion(o.clave, t)}
            onFocus={onActivar}
            placeholder={`Opción ${i + 1}`}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => agregarOpcion(o.clave)}
            accessibilityLabel={`Opción ${i + 1} de la pregunta ${numero}`}
            editable={!bloqueado}
          />
          {!bloqueado && pregunta.opciones.length > 2 && <Herramienta icono={X} etiqueta={`Quitar opción ${i + 1}`} onPress={() => quitarOpcion(o.clave)} />}
        </Fila>
      ))}
      {!bloqueado && (
        <Fila gap={10}>
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.borde, borderStyle: 'dashed' }} />
          <Text onPress={() => agregarOpcion()} style={{ color: c.violetaTexto, fontWeight: '700', paddingVertical: 6 }} accessibilityRole="button">
            Agregar opción
          </Text>
        </Fila>
      )}
      <View style={{ borderTopWidth: 1, borderColor: c.linea, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <InterruptorCampo valor={pregunta.obligatoria} onCambio={(v) => cambiar({ obligatoria: v })} disabled={bloqueado}>
          Obligatoria
        </InterruptorCampo>
        {!bloqueado && (
          <Fila gap={0}>
            <Herramienta icono={ArrowUp} etiqueta="Subir pregunta" onPress={() => onMover(-1)} disabled={numero === 1} />
            <Herramienta icono={ArrowDown} etiqueta="Bajar pregunta" onPress={() => onMover(1)} disabled={numero === total} />
            <Herramienta icono={Copy} etiqueta="Duplicar pregunta" onPress={onDuplicar} />
            <Herramienta icono={Trash2} etiqueta="Eliminar pregunta" onPress={onBorrar} disabled={total === 1} peligro />
          </Fila>
        )}
      </View>
    </Pressable>
  )
}

export default function EditorCuestionario({ id }) {
  const { c } = useTema()
  const esNuevo = !id
  const navigation = useNavigation()
  const scroll = useRef(null)
  const posiciones = useRef({})
  const [form, setForm] = useState(esNuevo ? { titulo: '', descripcion: '', categoria: '', activo: true, preguntas: [nuevaPregunta()] } : null)
  const [bloqueado, setBloqueado] = useState(false)
  const [categorias, setCategorias] = useState(null)
  const [activa, setActiva] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  // "Guardar" se habilita solo cuando el formulario es distinto de lo cargado
  const [original, setOriginal] = useState(() =>
    esNuevo ? JSON.stringify(paraServidor({ titulo: '', descripcion: '', categoria: '', activo: true, preguntas: [nuevaPregunta()] })) : null,
  )
  const saliendo = useRef(false)

  useEffect(() => {
    obtenerCategorias()
      .then(setCategorias)
      .catch((e) => setError(e.message))
    if (!esNuevo) {
      api
        .obtenerCuestionario(id)
        .then((q) => {
          const cargado = desdeServidor(q)
          setForm(cargado)
          setOriginal(JSON.stringify(paraServidor(cargado)))
          setBloqueado(q.bloqueado)
        })
        .catch((e) => setError(e.message))
    }
  }, [id, esNuevo])

  const sinGuardar = Boolean(form && original !== null && JSON.stringify(paraServidor(form)) !== original)

  // Avisa antes de salir con cambios sin guardar (botón atrás o gesto)
  useEffect(() => {
    if (!sinGuardar) return
    return navigation.addListener('beforeRemove', (e) => {
      if (saliendo.current) return
      e.preventDefault()
      Alert.alert('Cambios sin guardar', '¿Desea salir sin guardar los cambios?', [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ])
    })
  }, [navigation, sinGuardar])

  const actualizar = (cambios) => setForm((f) => ({ ...f, ...cambios }))
  const cambiarPregunta = (p) => actualizar({ preguntas: form.preguntas.map((x) => (x.clave === p.clave ? p : x)) })

  function insertarPregunta(pregunta, despuesDe) {
    if (form.preguntas.length >= MAX_PREGUNTAS) return
    const i = despuesDe ? form.preguntas.findIndex((p) => p.clave === despuesDe) + 1 : form.preguntas.length
    actualizar({ preguntas: [...form.preguntas.slice(0, i), pregunta, ...form.preguntas.slice(i)] })
    setActiva(pregunta.clave)
    // Lleva la vista a la pregunta nueva
    setTimeout(() => {
      const y = posiciones.current[pregunta.clave]
      if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: true })
    }, 120)
  }

  function mover(k, paso) {
    const lista = [...form.preguntas]
    const i = lista.findIndex((p) => p.clave === k)
    ;[lista[i], lista[i + paso]] = [lista[i + paso], lista[i]]
    actualizar({ preguntas: lista })
  }

  const duplicar = (p) => insertarPregunta({ ...p, clave: clave(), opciones: p.opciones.map((o) => nuevaOpcion(o.texto)) }, p.clave)

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const datos = paraServidor(form)
      const guardado = esNuevo ? await api.crearCuestionario(datos) : await api.guardarCuestionario(id, datos)
      setOriginal(JSON.stringify(datos))
      dejarAviso(esNuevo ? `El cuestionario «${guardado.titulo}» fue creado.` : 'Los cambios se guardaron correctamente.')
      saliendo.current = true
      if (router.canGoBack()) router.back()
      else router.replace('/cuestionarios')
    } catch (e) {
      setError(e.message)
      setGuardando(false)
      scroll.current?.scrollTo({ y: 0, animated: true })
    }
  }

  // Una categoría desactivada solo admite cuestionarios inactivos
  const categoriaElegida = categorias?.find((x) => String(x.id) === String(form?.categoria))
  const categoriaInactiva = Boolean(categoriaElegida && !categoriaElegida.activa)

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/cuestionarios'))

  if (!form) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: c.fondo }}>
        {error ? <Texto estilo="error">{error}</Texto> : <VacioTarjeta>Cargando…</VacioTarjeta>}
      </View>
    )
  }

  const campo = { color: c.texto, borderBottomWidth: 1.5, borderColor: c.borde, paddingVertical: 8 }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Fila style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.superficie, borderBottomWidth: 1, borderColor: c.linea, justifyContent: 'space-between' }}>
        <Pressable onPress={volver} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }} accessibilityRole="link">
          <ArrowLeft size={18} color={c.violetaTexto} />
          <Text style={{ color: c.violetaTexto, fontWeight: '700' }}>Cuestionarios</Text>
        </Pressable>
        <Fila>
          {sinGuardar ? <Texto estilo="chico">Sin guardar</Texto> : null}
          <Boton titulo={guardando ? 'Guardando…' : esNuevo ? 'Crear' : 'Guardar'} onPress={guardar} cargando={guardando} disabled={!sinGuardar} chico />
        </Fila>
      </Fila>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 60, maxWidth: 800, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {error ? (
          <Text style={{ color: c.rojoTexto, backgroundColor: c.fondoError, borderColor: c.bordeError, borderWidth: 1, padding: 12, borderRadius: 10 }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={{ ...estiloTarjeta(c), borderTopWidth: 8, borderTopColor: MARCA.violeta, padding: 16, gap: 10 }}>
          <TextInput
            style={[campo, { fontSize: 22, fontWeight: '800' }]}
            value={form.titulo}
            onChangeText={(t) => actualizar({ titulo: t })}
            placeholder="Título del cuestionario"
            maxLength={180}
            autoCapitalize="sentences"
          />
          <TextInput
            style={[campo, { fontSize: 15 }]}
            multiline
            value={form.descripcion}
            onChangeText={(t) => actualizar({ descripcion: t })}
            placeholder="Descripción"
            maxLength={1000}
          />
          <Selector
            etiqueta="Categoría"
            valor={form.categoria ?? ''}
            placeholder="Seleccione una categoría"
            onCambio={(v) => {
              const elegida = categorias?.find((x) => String(x.id) === String(v))
              // En una categoría desactivada el cuestionario queda inactivo
              actualizar({ categoria: String(v), ...(elegida && !elegida.activa && { activo: false }) })
            }}
            opciones={(categorias ?? [])
              .filter((x) => x.activa || String(x.id) === String(form.categoria))
              .map((x) => ({ valor: String(x.id), texto: `${x.nombre}${x.activa ? '' : ' (desactivada)'}` }))}
          />
          <InterruptorCampo valor={form.activo} onCambio={(v) => actualizar({ activo: v })} disabled={categoriaInactiva}>
            Activo
          </InterruptorCampo>
          {categoriaInactiva && <Texto estilo="chico">La categoría está desactivada: el cuestionario debe quedar inactivo.</Texto>}
          {categorias?.length === 0 && (
            <Text style={{ color: c.gris }}>
              Todavía no hay categorías.{' '}
              <Text style={{ color: c.violetaTexto, fontWeight: '700' }} onPress={() => router.navigate('/categorias')}>
                Cree una en Categorías
              </Text>
              .
            </Text>
          )}
          {bloqueado && (
            <Text style={{ color: c.magentaTexto, backgroundColor: c.fondoMagenta, padding: 10, borderRadius: 10 }}>
              Este cuestionario ya tiene encuestas cargadas: las preguntas y opciones no se pueden modificar.
            </Text>
          )}
        </View>

        {form.preguntas.map((p, i) => (
          <View key={p.clave} onLayout={(e) => (posiciones.current[p.clave] = e.nativeEvent.layout.y)}>
            <TarjetaPregunta
              pregunta={p}
              numero={i + 1}
              total={form.preguntas.length}
              activa={activa === p.clave}
              bloqueado={bloqueado}
              onActivar={() => setActiva(p.clave)}
              onCambio={cambiarPregunta}
              onMover={(paso) => mover(p.clave, paso)}
              onDuplicar={() => duplicar(p)}
              onBorrar={() => actualizar({ preguntas: form.preguntas.filter((x) => x.clave !== p.clave) })}
            />
          </View>
        ))}

        {!bloqueado &&
          (form.preguntas.length < MAX_PREGUNTAS ? (
            <Pressable
              onPress={() => insertarPregunta(nuevaPregunta(), activa)}
              style={({ pressed }) => ({
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: MARCA.violeta,
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
                backgroundColor: pressed ? c.superficie2 : 'transparent',
              })}
            >
              <Text style={{ color: c.violetaTexto, fontWeight: '800' }}>
                + Agregar pregunta ({form.preguntas.length} de {MAX_PREGUNTAS})
              </Text>
            </Pressable>
          ) : (
            <Texto estilo="suave" style={{ textAlign: 'center' }}>
              Se alcanzó el máximo de {MAX_PREGUNTAS} preguntas por cuestionario.
            </Texto>
          ))}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
