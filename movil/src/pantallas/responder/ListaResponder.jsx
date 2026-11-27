import { useCallback, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ArrowRight } from 'lucide-react-native'
import * as api from '../../api/encuestas'
import { MARCA, useTema } from '../../tema/tema'
import { Encabezado, Esqueleto, Fila, Pagina, Paginacion, Texto, TextoError, VacioTarjeta, usePaginado, Text, estiloTarjeta } from '../../ui'

// Vista del militante: cuestionarios activos para cargar encuestas
export default function ListaResponder() {
  const { c } = useTema()
  const [cuestionarios, setCuestionarios] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(
    () =>
      api
        .obtenerParaResponder()
        .then(setCuestionarios)
        .catch((e) => setError(e.message)),
    [],
  )
  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar]),
  )
  const paginado = usePaginado(cuestionarios ?? [])

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado titulo="Encuestas" descripcion="Seleccione el cuestionario que va a cargar." />
      {error ? (
        <TextoError>{error}</TextoError>
      ) : cuestionarios === null ? (
        <Esqueleto filas={2} />
      ) : cuestionarios.length === 0 ? (
        <VacioTarjeta titulo="No hay cuestionarios activos.">Cuando la administración active uno, aparecerá aquí.</VacioTarjeta>
      ) : (
        <>
          {paginado.items.map((q) => (
            <Pressable
              key={q.id}
              onPress={() => router.push(`/responder/${q.id}`)}
              accessibilityRole="link"
              style={({ pressed }) => ({
                ...estiloTarjeta(c),
                opacity: pressed ? 0.9 : 1,
                borderLeftWidth: 5,
                borderLeftColor: MARCA.magenta,
                padding: 16,
                gap: 6,
              })}
            >
              <View style={{ alignSelf: 'flex-start', backgroundColor: c.fondoMagenta, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: c.magentaTexto, fontWeight: '800', fontSize: 12 }}>{q.categoria}</Text>
              </View>
              <Texto estilo="subtitulo">{q.titulo}</Texto>
              {q.descripcion ? <Texto estilo="suave">{q.descripcion}</Texto> : null}
              <Fila style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <Texto estilo="chico">{q.preguntas === 1 ? '1 pregunta' : `${q.preguntas} preguntas`}</Texto>
                <Fila gap={4}>
                  <Text style={{ color: c.magentaTexto, fontWeight: '800' }}>Responder</Text>
                  <ArrowRight size={16} color={c.magentaTexto} />
                </Fila>
              </Fila>
            </Pressable>
          ))}
          <Paginacion {...paginado} />
        </>
      )}
    </Pagina>
  )
}
