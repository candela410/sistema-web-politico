import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Check, Minus } from 'lucide-react-native'
import * as api from '../../api/cuestionarios'
import { MARCA, useTema } from '../../tema/tema'
import { Acciones, Boton, Casilla, Esqueleto, Etiqueta, Fila, Modal, Texto, TextoError, Text } from '../../ui'

// Check de un equipo: marca o desmarca a todos sus integrantes. Queda "a medias" si solo están algunos.
function CheckEquipo({ marcados, total, onPress, etiqueta }) {
  const { c } = useTema()
  const todos = total > 0 && marcados === total
  const medias = marcados > 0 && marcados < total
  return (
    <Pressable
      onPress={onPress}
      disabled={total === 0}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: todos ? true : medias ? 'mixed' : false }}
      accessibilityLabel={etiqueta}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: todos || medias ? MARCA.violeta : c.borde,
        backgroundColor: todos || medias ? MARCA.violeta : c.superficie,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: total === 0 ? 0.4 : 1,
      }}
    >
      {todos ? <Check size={15} color="#fff" strokeWidth={3} /> : medias ? <Minus size={15} color="#fff" strokeWidth={3} /> : null}
    </Pressable>
  )
}

function Grupo({ titulo, inactivo, usuarios, elegidos, alternar, alternarTodos }) {
  const { c } = useTema()
  const elegibles = usuarios.filter((u) => u.elegible)
  const marcados = elegibles.filter((u) => elegidos.has(u.id)).length
  return (
    <View style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 12, padding: 10, marginBottom: 10 }}>
      <Fila gap={10} style={{ paddingBottom: 6, borderBottomWidth: 1, borderColor: c.linea, marginBottom: 4 }}>
        <CheckEquipo
          marcados={marcados}
          total={elegibles.length}
          etiqueta={`Asignar a todo ${titulo}`}
          onPress={() => alternarTodos(elegibles, marcados < elegibles.length)}
        />
        <Texto estilo="negrita" style={{ flex: 1 }}>
          {titulo}
        </Texto>
        {inactivo && <Etiqueta>Inactivo</Etiqueta>}
        <Texto estilo="chico">
          {marcados}/{elegibles.length}
        </Texto>
      </Fila>
      {usuarios.map((u) => (
        <Casilla
          key={u.id}
          marcada={elegidos.has(u.id)}
          // El que ya no está activo solo se puede quitar
          disabled={!u.elegible && !elegidos.has(u.id)}
          onCambio={() => alternar(u.id)}
        >
          <Text style={{ color: c.texto, textDecorationLine: u.elegible ? 'none' : 'line-through' }}>{u.nombre}</Text>
          <Texto estilo="chico">{u.elegible ? u.email : 'Usuario inactivo'}</Texto>
        </Casilla>
      ))}
    </View>
  )
}

export default function AsignarCuestionario({ cuestionario, onCerrar, onGuardado }) {
  const { c: colores } = useTema()
  const [datos, setDatos] = useState(null)
  const [elegidos, setElegidos] = useState(new Set())
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [iniciales, setIniciales] = useState('')
  const conCambios = datos !== null && [...elegidos].sort().join(',') !== iniciales

  useEffect(() => {
    api
      .obtenerAsignaciones(cuestionario.id)
      .then((d) => {
        setDatos(d)
        const todos = [...d.equipos.flatMap((e) => e.usuarios), ...d.sin_equipo]
        const asignados = todos.filter((u) => u.asignado).map((u) => u.id)
        setElegidos(new Set(asignados))
        setIniciales([...new Set(asignados)].sort().join(','))
      })
      .catch((e) => setError(e.message))
  }, [cuestionario.id])

  const hayMilitantes = useMemo(() => datos && (datos.equipos.length > 0 || datos.sin_equipo.length > 0), [datos])

  function alternar(id) {
    setElegidos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }
  function alternarTodos(usuarios, marcar) {
    setElegidos((actual) => {
      const nuevo = new Set(actual)
      usuarios.forEach((u) => (marcar ? nuevo.add(u.id) : nuevo.delete(u.id)))
      return nuevo
    })
  }

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const r = await api.guardarAsignaciones(cuestionario.id, [...elegidos])
      onGuardado(r.asignados)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  const q = datos?.cuestionario
  return (
    <Modal
      titulo="Asignar cuestionario"
      onCerrar={onCerrar}
      ancho
      pie={
        <Acciones onCancelar={onCerrar}>
          <Boton titulo={guardando ? 'Guardando…' : 'Guardar cambios'} onPress={guardar} cargando={guardando} disabled={!datos || !conCambios} />
        </Acciones>
      }
    >
      <View style={{ gap: 2, marginBottom: 10 }}>
        <Text style={{ color: colores.magentaTexto, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>{q?.categoria ?? cuestionario.categoria.nombre}</Text>
        <Texto estilo="negrita">{cuestionario.titulo}</Texto>
        {q && (
          <Texto estilo="chico">
            {q.preguntas === 1 ? '1 pregunta' : `${q.preguntas} preguntas`}
            {q.descripcion ? ` · ${q.descripcion}` : ''}
          </Texto>
        )}
      </View>
      {q && !q.activo && (
        <Texto style={{ backgroundColor: colores.fondoMagenta, color: colores.magentaTexto, padding: 10, borderRadius: 10, marginBottom: 10 }}>
          Este cuestionario está inactivo: no se mostrará para cargar encuestas hasta que se active.
        </Texto>
      )}
      {datos === null && !error && <Esqueleto filas={2} />}
      {datos && !hayMilitantes && <Texto>No hay usuarios activos en la campaña.</Texto>}
      {datos && hayMilitantes && (
        <>
          <Texto estilo="suave" style={{ marginBottom: 10 }}>
            Marque un equipo para asignarlo a todos sus integrantes o seleccione personas individuales. Si alguien se suma a un equipo después, deberá
            asignarse nuevamente.
          </Texto>
          {datos.equipos.map((e) => (
            <Grupo key={e.id} titulo={e.nombre} inactivo={!e.activo} usuarios={e.usuarios} elegidos={elegidos} alternar={alternar} alternarTodos={alternarTodos} />
          ))}
          {datos.sin_equipo.length > 0 && (
            <Grupo titulo="Sin equipo" usuarios={datos.sin_equipo} elegidos={elegidos} alternar={alternar} alternarTodos={alternarTodos} />
          )}
          <Texto estilo="chico">{elegidos.size === 1 ? '1 usuario seleccionado.' : `${elegidos.size} usuarios seleccionados.`}</Texto>
        </>
      )}
      <TextoError>{error}</TextoError>
    </Modal>
  )
}
