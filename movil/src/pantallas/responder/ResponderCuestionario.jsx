import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowLeft, Check, MapPin } from 'lucide-react-native'
import * as api from '../../api/encuestas'
import { MARCA, useTema } from '../../tema/tema'
import { Boton, Entrada, Fila, Texto, VacioTarjeta, Text, estiloTarjeta } from '../../ui'
import { errorDocumento, errorPersona } from '../../util/validaciones'
import { ErrorUbicacion, obtenerUbicacion } from '../../util/ubicacion'

// Carga de una encuesta (datos de la persona + respuestas). Los errores se
// marcan en el momento: el documento y los nombres al salir del campo, y una
// pregunta obligatoria sin responder apenas se responde una posterior.
// Al enviar se toma la ubicación GPS del celular (util/ubicacion.js) y va junto
// con las respuestas: sin una ubicación válida la encuesta no se envía.
const ENCUESTADO_VACIO = { documento: '', nombre: '', apellido: '' }

function Pregunta({ pregunta, numero, elegidas, error, onCambio }) {
  const { c } = useTema()
  const multiple = pregunta.tipo === 'opcion_multiple'
  function alternar(id) {
    if (!multiple) onCambio([id])
    else onCambio(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id])
  }
  return (
    <View
      style={{
        ...estiloTarjeta(c),
        ...(error ? { borderWidth: 1.5, borderColor: c.rojoTexto } : null),
        padding: 14,
        gap: 8,
      }}
    >
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: MARCA.violeta, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{numero}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.texto, fontSize: 16.5, fontWeight: '700' }}>
            {pregunta.enunciado}
            {pregunta.obligatoria ? (
              <Text style={{ color: c.rojoTexto }} accessibilityLabel="obligatoria">
                {' '}
                *
              </Text>
            ) : null}
          </Text>
          {multiple && <Texto estilo="chico">Puede elegir varias opciones</Texto>}
        </View>
      </Fila>
      {pregunta.opciones.map((o) => {
        const marcada = elegidas.includes(o.id)
        return (
          <Pressable
            key={o.id}
            onPress={() => alternar(o.id)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: marcada }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: marcada ? MARCA.violeta : c.linea,
              backgroundColor: marcada ? c.superficie2 : pressed ? c.fondo : c.superficie,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: multiple ? 6 : 11,
                borderWidth: 2,
                borderColor: marcada ? MARCA.violeta : c.borde,
                backgroundColor: marcada && multiple ? MARCA.violeta : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {marcada && (multiple ? <Check size={14} color="#fff" strokeWidth={3} /> : <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: MARCA.violeta }} />)}
            </View>
            <Text style={{ color: c.texto, fontSize: 15.5, flex: 1 }}>{o.texto}</Text>
          </Pressable>
        )
      })}
      {!pregunta.obligatoria && !multiple && elegidas.length > 0 && (
        <Text onPress={() => onCambio([])} style={{ color: c.violetaTexto, fontWeight: '700', alignSelf: 'flex-end', padding: 4 }}>
          Borrar selección
        </Text>
      )}
      {error ? <Texto estilo="error">{error}</Texto> : null}
    </View>
  )
}

export default function ResponderCuestionario({ id }) {
  const { c } = useTema()
  const scroll = useRef(null)
  const [cuestionario, setCuestionario] = useState(null)
  const [encuestado, setEncuestado] = useState(ENCUESTADO_VACIO)
  const [respuestas, setRespuestas] = useState({})
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [tocados, setTocados] = useState({})
  // Ubicación GPS: 'obteniendo' mientras se lee; el error explica qué falta
  const [ubicando, setUbicando] = useState(false)
  const [errorGps, setErrorGps] = useState(null)

  const erroresPersona = {
    documento: errorDocumento(encuestado.documento),
    nombre: errorPersona(encuestado.nombre),
    apellido: errorPersona(encuestado.apellido, 'El apellido'),
  }
  const errorDe = (campo) => (tocados[campo] ? erroresPersona[campo] : '')
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }))

  useEffect(() => {
    api
      .obtenerCuestionarioParaResponder(id)
      .then(setCuestionario)
      .catch((e) => setError(e.message))
  }, [id])

  const cambiarEncuestado = (campo) => (texto) => {
    // El documento admite solo números, hasta 8
    const valor = campo === 'documento' ? texto.replace(/\D/g, '').slice(0, 8) : texto
    setEncuestado((d) => ({ ...d, [campo]: valor }))
    if (campo !== 'documento' && errorPersona(valor)) setTocados((t) => ({ ...t, [campo]: true }))
  }

  function responder(pregunta, valor) {
    setRespuestas((r) => ({ ...r, [pregunta]: valor }))
    const indice = cuestionario.preguntas.findIndex((p) => p.id === pregunta)
    setErrores((e) => {
      const nuevos = { ...e, [pregunta]: '' }
      cuestionario.preguntas.slice(0, indice).forEach((p) => {
        if (p.obligatoria && !(respuestas[p.id]?.length > 0)) nuevos[p.id] = 'Esta pregunta es obligatoria.'
      })
      return nuevos
    })
    setError('')
  }

  function validar() {
    const faltan = {}
    for (const p of cuestionario.preguntas) {
      if (p.obligatoria && !(respuestas[p.id]?.length > 0)) faltan[p.id] = 'Esta pregunta es obligatoria.'
    }
    setErrores(faltan)
    return Object.keys(faltan).length === 0
  }

  async function enviar() {
    setError('')
    setTocados({ documento: true, nombre: true, apellido: true })
    const preguntasBien = validar()
    if (!preguntasBien || Object.values(erroresPersona).some(Boolean)) {
      setError('Revise los campos marcados en rojo.')
      scroll.current?.scrollTo({ y: 0, animated: true })
      return
    }
    // Ubicación real del lugar donde se cargó: sin ella no se envía
    setErrorGps(null)
    setUbicando(true)
    let ubicacion
    try {
      ubicacion = await obtenerUbicacion()
    } catch (e) {
      setErrorGps(e instanceof ErrorUbicacion ? e : new ErrorUbicacion('sin_senal', e.message))
      scroll.current?.scrollToEnd({ animated: true })
      return
    } finally {
      setUbicando(false)
    }
    setEnviando(true)
    try {
      await api.enviarRespuestas(id, {
        encuestado,
        respuestas: cuestionario.preguntas.filter((p) => respuestas[p.id]?.length > 0).map((p) => ({ pregunta: p.id, opciones: respuestas[p.id] })),
        latitud: ubicacion.latitud,
        longitud: ubicacion.longitud,
      })
      setEnviado(true)
    } catch (e) {
      setError(e.message)
      scroll.current?.scrollTo({ y: 0, animated: true })
    } finally {
      setEnviando(false)
    }
  }

  function otraEncuesta() {
    setEncuestado(ENCUESTADO_VACIO)
    setTocados({})
    setRespuestas({})
    setErrores({})
    setError('')
    setErrorGps(null)
    setEnviado(false)
  }

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/responder'))

  if (!cuestionario) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: c.fondo }}>
        {error ? <Texto estilo="error">{error}</Texto> : <VacioTarjeta>Cargando…</VacioTarjeta>}
      </View>
    )
  }

  if (enviado) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: c.fondo, justifyContent: 'center' }}>
        <View style={{ ...estiloTarjeta(c), padding: 24, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#1f8a5b', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={34} color="#fff" strokeWidth={3} />
          </View>
          <Texto estilo="titulo" style={{ textAlign: 'center' }}>
            ¡Encuesta guardada!
          </Texto>
          <Texto estilo="suave" style={{ textAlign: 'center' }}>
            Se registró la respuesta para «{cuestionario.titulo}».
          </Texto>
          <Boton titulo="Cargar otra encuesta" onPress={otraEncuesta} grande style={{ alignSelf: 'stretch' }} />
          <Boton titulo="Volver a encuestas" variante="borde" onPress={volver} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Fila style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.superficie, borderBottomWidth: 1, borderColor: c.linea }}>
        <Pressable onPress={volver} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }} accessibilityRole="link">
          <ArrowLeft size={18} color={c.violetaTexto} />
          <Text style={{ color: c.violetaTexto, fontWeight: '700' }}>Encuestas</Text>
        </Pressable>
      </Fila>
      <ScrollView ref={scroll} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40, maxWidth: 800, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ ...estiloTarjeta(c), borderTopWidth: 8, borderTopColor: MARCA.magenta, padding: 16, gap: 6 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: c.fondoMagenta, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
            <Text style={{ color: c.magentaTexto, fontWeight: '800', fontSize: 12 }}>{cuestionario.categoria}</Text>
          </View>
          <Texto estilo="titulo" style={{ fontSize: 22 }}>
            {cuestionario.titulo}
          </Texto>
          {cuestionario.descripcion ? <Texto estilo="suave">{cuestionario.descripcion}</Texto> : null}
          <Texto estilo="chico">
            <Text style={{ color: c.rojoTexto }}>*</Text> Indica que la pregunta es obligatoria
          </Texto>
        </View>

        {error ? (
          <Text style={{ color: c.rojoTexto, backgroundColor: c.fondoError, borderColor: c.bordeError, borderWidth: 1, padding: 12, borderRadius: 10 }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View style={{ ...estiloTarjeta(c), padding: 14 }}>
          <Texto estilo="negrita" style={{ fontSize: 16, marginBottom: 10 }}>
            Datos de la persona encuestada
          </Texto>
          <Entrada
            etiqueta="Documento *"
            keyboardType="number-pad"
            value={encuestado.documento}
            onChangeText={cambiarEncuestado('documento')}
            onBlur={tocar('documento')}
            placeholder="Sin puntos, 7 u 8 números"
            maxLength={10}
            error={errorDe('documento')}
          />
          <Fila gap={10} style={{ alignItems: 'flex-start' }}>
            <Entrada
              style={{ flex: 1 }}
              etiqueta="Nombre"
              autoCapitalize="words"
              maxLength={100}
              value={encuestado.nombre}
              onChangeText={cambiarEncuestado('nombre')}
              onBlur={tocar('nombre')}
              error={errorDe('nombre')}
            />
            <Entrada
              style={{ flex: 1 }}
              etiqueta="Apellido"
              autoCapitalize="words"
              maxLength={100}
              value={encuestado.apellido}
              onChangeText={cambiarEncuestado('apellido')}
              onBlur={tocar('apellido')}
              error={errorDe('apellido')}
            />
          </Fila>
        </View>

        {cuestionario.preguntas.map((p, i) => (
          <Pregunta key={p.id} pregunta={p} numero={i + 1} elegidas={respuestas[p.id] ?? []} error={errores[p.id]} onCambio={(v) => responder(p.id, v)} />
        ))}

        {errorGps ? (
          <View
            style={{ backgroundColor: c.fondoError, borderColor: c.bordeError, borderWidth: 1, padding: 12, borderRadius: 10, gap: 8 }}
            accessibilityRole="alert"
          >
            <Fila gap={8} style={{ alignItems: 'flex-start' }}>
              <MapPin size={18} color={c.rojoTexto} />
              <Text style={{ color: c.rojoTexto, flex: 1 }}>{errorGps.message}</Text>
            </Fila>
            {errorGps.codigo === 'permiso_bloqueado' && (
              <Boton titulo="Abrir configuración" variante="borde" chico onPress={() => Linking.openSettings()} />
            )}
          </View>
        ) : null}

        <Boton
          titulo={ubicando ? 'Obteniendo ubicación…' : enviando ? 'Enviando…' : errorGps ? 'Reintentar' : 'Enviar encuesta'}
          onPress={enviar}
          cargando={ubicando || enviando}
          grande
        />
        <Texto estilo="chico" style={{ textAlign: 'center' }}>
          Al enviar se registra la ubicación del celular donde se realizó la encuesta.
        </Texto>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
