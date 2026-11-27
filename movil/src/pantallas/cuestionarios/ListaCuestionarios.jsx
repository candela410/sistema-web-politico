import { useCallback, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { ChartColumn, Eye, Pencil, Trash2, UserPlus } from 'lucide-react-native'
import * as api from '../../api/cuestionarios'
import { MARCA, useTema } from '../../tema/tema'
import {
  estiloTarjeta,
  Text,
  AvisoOk,
  Boton,
  BotonIcono,
  Buscador,
  Confirmacion,
  Encabezado,
  Esqueleto,
  Etiqueta,
  Fila,
  Pagina,
  Paginacion,
  Selector,
  Texto,
  TextoError,
  VacioTarjeta,
  useAviso,
  usePaginado,
} from '../../ui'
import { tomarAviso } from '../../util/avisoPendiente'
import { normalizar } from '../../util/normalizar'
import { tiene } from '../../util/permisos'
import AsignarCuestionario from './AsignarCuestionario'
import VerCuestionario from './VerCuestionario'

const FILTROS_INICIALES = { categoria: '', estado: 'todos' }

export default function ListaCuestionarios({ usuario }) {
  const { c } = useTema()
  const [cuestionarios, setCuestionarios] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const filtrando = busqueda.trim() || Object.entries(filtros).some(([k, v]) => v !== FILTROS_INICIALES[k])
  const [borrando, setBorrando] = useState(null)
  const [errorBorrar, setErrorBorrar] = useState('')
  const [asignando, setAsignando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const [aviso, avisar] = useAviso()

  const cargar = useCallback(
    () =>
      api
        .obtenerCuestionarios()
        .then(setCuestionarios)
        .catch((e) => setErrorCarga(e.message)),
    [],
  )

  // Al volver del editor se recarga la lista y se muestra su aviso
  useFocusEffect(
    useCallback(() => {
      cargar()
      const pendiente = tomarAviso()
      if (pendiente) avisar(pendiente)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargar]),
  )

  const categorias = useMemo(() => {
    const unicas = new Map((cuestionarios ?? []).map((x) => [String(x.categoria.id), x.categoria.nombre]))
    return [...unicas].sort((a, b) => a[1].localeCompare(b[1]))
  }, [cuestionarios])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    return (cuestionarios ?? []).filter(
      (x) =>
        (!texto || normalizar(x.titulo).includes(texto) || normalizar(x.categoria.nombre).includes(texto)) &&
        (!filtros.categoria || String(x.categoria.id) === filtros.categoria) &&
        (filtros.estado === 'todos' || x.activo === (filtros.estado === 'activos')),
    )
  }, [cuestionarios, busqueda, filtros])
  const paginado = usePaginado(visibles)
  const filtrar = (campo) => (v) => setFiltros((f) => ({ ...f, [campo]: String(v) }))

  async function borrar() {
    setErrorBorrar('')
    try {
      await api.borrarCuestionario(borrando.id)
      setCuestionarios((lista) => lista.filter((x) => x.id !== borrando.id))
      setBorrando(null)
      avisar('El cuestionario fue eliminado.')
    } catch (e) {
      setErrorBorrar(e.message)
    }
  }

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado
        titulo="Cuestionarios"
        descripcion="Encuestas con sus preguntas y opciones."
        accion={tiene(usuario, 'core.add_cuestionario') ? '+ Crear cuestionario' : null}
        onAccion={() => router.push('/cuestionarios/nuevo')}
      />
      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por título" etiqueta="Buscar cuestionarios" />
      <Fila gap={10} style={{ alignItems: 'flex-end' }}>
        <Selector
          style={{ flex: 1, marginBottom: 0 }}
          etiqueta="Categoría"
          valor={filtros.categoria}
          onCambio={filtrar('categoria')}
          opciones={[{ valor: '', texto: 'Todas' }, ...categorias.map(([id, nombre]) => ({ valor: id, texto: nombre }))]}
        />
        <Selector
          style={{ flex: 1, marginBottom: 0 }}
          etiqueta="Estado"
          valor={filtros.estado}
          onCambio={filtrar('estado')}
          opciones={[
            { valor: 'todos', texto: 'Todos' },
            { valor: 'activos', texto: 'Activos' },
            { valor: 'inactivos', texto: 'Inactivos' },
          ]}
        />
      </Fila>
      {filtrando ? (
        <Text
          onPress={() => {
            setFiltros(FILTROS_INICIALES)
            setBusqueda('')
          }}
          style={{ color: c.violetaTexto, fontWeight: '700' }}
          accessibilityRole="button"
        >
          Limpiar filtros
        </Text>
      ) : null}
      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <TextoError>{errorCarga}</TextoError>
      ) : cuestionarios === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        cuestionarios.length === 0 ? (
          <VacioTarjeta titulo="Todavía no hay cuestionarios.">Cree el primero con «+ Crear cuestionario».</VacioTarjeta>
        ) : (
          <VacioTarjeta>No hay cuestionarios que coincidan con la búsqueda y los filtros.</VacioTarjeta>
        )
      ) : (
        <>
          {paginado.items.map((x) => (
            <View key={x.id} style={{ ...estiloTarjeta(c), borderLeftWidth: 4, borderLeftColor: MARCA.violeta }}>
              <Pressable
                onPress={() => router.push(`/cuestionarios/${x.id}`)}
                style={({ pressed }) => ({ padding: 14, gap: 4, borderTopRightRadius: 18, borderBottomRightRadius: 18, backgroundColor: pressed ? c.superficie2 : 'transparent' })}
              >
                <Text style={{ color: c.magentaTexto, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>{x.categoria.nombre}</Text>
                <Texto estilo="subtitulo">{x.titulo}</Texto>
                {x.descripcion ? <Texto estilo="suave">{x.descripcion}</Texto> : null}
                <Fila envolver gap={6}>
                  <Texto estilo="chico">
                    {x.preguntas === 1 ? '1 pregunta' : `${x.preguntas} preguntas`} · {x.encuestas === 1 ? '1 encuesta' : `${x.encuestas} encuestas`}
                  </Texto>
                  {!x.activo && <Etiqueta>Inactivo</Etiqueta>}
                </Fila>
              </Pressable>
              <Fila gap={8} envolver style={{ paddingHorizontal: 14, paddingBottom: 12, justifyContent: 'flex-end' }}>
                <BotonIcono icono={Eye} etiqueta="Ver detalles" onPress={() => setViendo(x)} />
                {tiene(usuario, 'core.view_encuesta') && (
                  <BotonIcono icono={ChartColumn} etiqueta="Estadísticas" variante="lleno" onPress={() => router.push(`/cuestionarios/${x.id}/estadisticas`)} />
                )}
                {tiene(usuario, 'core.change_asignacioncuestionario') && <BotonIcono icono={UserPlus} etiqueta="Asignar a usuarios" onPress={() => setAsignando(x)} />}
                {tiene(usuario, 'core.change_cuestionario') && <BotonIcono icono={Pencil} etiqueta="Editar" onPress={() => router.push(`/cuestionarios/${x.id}`)} />}
                {tiene(usuario, 'core.delete_cuestionario') && <BotonIcono icono={Trash2} etiqueta="Eliminar" variante="peligro" onPress={() => setBorrando(x)} />}
              </Fila>
            </View>
          ))}
          <Paginacion {...paginado} />
        </>
      )}

      {viendo && <VerCuestionario cuestionario={viendo} usuario={usuario} onCerrar={() => setViendo(null)} />}
      {asignando && (
        <AsignarCuestionario
          cuestionario={asignando}
          onCerrar={() => setAsignando(null)}
          onGuardado={(cantidad) => {
            setAsignando(null)
            avisar(
              cantidad === 0
                ? `«${asignando.titulo}» quedó sin usuarios asignados.`
                : `«${asignando.titulo}» quedó asignado a ${cantidad === 1 ? '1 usuario' : `${cantidad} usuarios`}.`,
            )
          }}
        />
      )}
      {borrando && (
        <Confirmacion
          titulo="Eliminar cuestionario"
          textoConfirmar="Eliminar"
          error={errorBorrar}
          onConfirmar={borrar}
          onCerrar={() => {
            setBorrando(null)
            setErrorBorrar('')
          }}
        >
          {`¿Desea eliminar «${borrando.titulo}» con todas sus preguntas? Esta acción no se puede deshacer.`}
        </Confirmacion>
      )}
      {/* Botón grande al pie para crear en el celular, sin subir hasta arriba */}
      {tiene(usuario, 'core.add_cuestionario') && cuestionarios?.length > 5 && (
        <Boton titulo="+ Crear cuestionario" variante="borde" onPress={() => router.push('/cuestionarios/nuevo')} />
      )}
    </Pagina>
  )
}
