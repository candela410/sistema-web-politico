import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { Pencil, Trash2 } from 'lucide-react-native'
import * as api from '../../api/categorias'
import {
  Acciones,
  AvisoOk,
  Boton,
  BotonIcono,
  Buscador,
  Confirmacion,
  Encabezado,
  Entrada,
  Esqueleto,
  Etiqueta,
  Fila,
  Interruptor,
  Modal,
  Pagina,
  Paginacion,
  Tarjeta,
  Texto,
  TextoError,
  VacioTarjeta,
  useAviso,
  usePaginado,
} from '../../ui'
import { normalizar } from '../../util/normalizar'
import { tiene } from '../../util/permisos'
import { useConCambios } from '../../util/validaciones'

const ordenar = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

function FormularioCategoria({ categoria, onGuardada, onCerrar }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, descripcion })

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre, descripcion }
      const guardada = categoria ? await api.editarCategoria(categoria.id, datos) : await api.crearCategoria(datos)
      onGuardada(guardada, !categoria)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}>
      <Entrada etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej.: Seguridad" maxLength={120} autoCapitalize="sentences" autoFocus />
      <Entrada etiqueta="Descripción" value={descripcion} onChangeText={setDescripcion} placeholder="Qué tipo de cuestionarios agrupa" maxLength={500} multiline />
      <TextoError>{error}</TextoError>
      <Acciones onCancelar={onCerrar}>
        <Boton
          titulo={guardando ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
          onPress={guardar}
          cargando={guardando}
          disabled={!nombre.trim() || !conCambios}
        />
      </Acciones>
    </Modal>
  )
}

export default function Categorias({ usuario }) {
  const [categorias, setCategorias] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nueva' | categoría
  const [borrando, setBorrando] = useState(null)
  const [errorBorrar, setErrorBorrar] = useState('')
  const [aviso, avisar] = useAviso()

  const cargar = () =>
    api
      .obtenerCategorias()
      .then(setCategorias)
      .catch((e) => setErrorCarga(e.message))
  useEffect(() => {
    cargar()
  }, [])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!categorias || !texto) return categorias ?? []
    return categorias.filter((c) => normalizar(c.nombre).includes(texto) || normalizar(c.descripcion).includes(texto))
  }, [categorias, busqueda])
  const paginado = usePaginado(visibles)

  // Desactivar una categoría desactiva también todos sus cuestionarios
  async function cambiarEstado(categoria, activa) {
    try {
      const r = await api.cambiarEstadoCategoria(categoria.id, activa)
      setCategorias((lista) => lista.map((c) => (c.id === categoria.id ? r.categoria : c)))
      avisar(
        activa
          ? `La categoría «${categoria.nombre}» fue activada.`
          : `La categoría «${categoria.nombre}» fue desactivada${
              r.cuestionarios_desactivados
                ? ` junto con ${r.cuestionarios_desactivados} cuestionario${r.cuestionarios_desactivados === 1 ? '' : 's'}`
                : ''
            }.`,
      )
    } catch (e) {
      setErrorCarga(e.message)
    }
  }
  const puedeEditar = tiene(usuario, 'core.change_categoria')

  async function borrar() {
    setErrorBorrar('')
    try {
      await api.borrarCategoria(borrando.id)
      setCategorias((lista) => lista.filter((c) => c.id !== borrando.id))
      setBorrando(null)
      avisar('La categoría fue eliminada.')
    } catch (e) {
      setErrorBorrar(e.message)
    }
  }

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado titulo="Categorías" descripcion="Agrupan los cuestionarios por tema." accion="+ Nueva categoría" onAccion={() => setEditando('nueva')} />
      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre o descripción" etiqueta="Buscar categorías" />
      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <TextoError>{errorCarga}</TextoError>
      ) : categorias === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        categorias.length === 0 ? (
          <VacioTarjeta titulo="Todavía no hay categorías.">Cree la primera con «+ Nueva categoría».</VacioTarjeta>
        ) : (
          <VacioTarjeta>No hay categorías que coincidan con «{busqueda}».</VacioTarjeta>
        )
      ) : (
        <>
          {paginado.items.map((c) => (
            <Tarjeta key={c.id} apagada={!c.activa} style={{ gap: 10 }}>
              <View style={{ gap: 4 }}>
                <Fila envolver>
                  <Texto estilo="subtitulo">{c.nombre}</Texto>
                  {!c.activa && <Etiqueta>Desactivada</Etiqueta>}
                </Fila>
                {c.descripcion ? <Texto estilo="suave">{c.descripcion}</Texto> : null}
                <Texto estilo="chico">{c.cuestionarios === 1 ? '1 cuestionario' : `${c.cuestionarios} cuestionarios`}</Texto>
              </View>
              <Fila style={{ justifyContent: 'space-between' }}>
                {puedeEditar ? (
                  <Interruptor
                    activo={c.activa}
                    onCambiar={(activa) => cambiarEstado(c, activa)}
                    etiqueta={`Categoría ${c.nombre} activa`}
                    textos={['Activa', 'Inactiva']}
                    confirmacion={{
                      titulo: 'Desactivar categoría',
                      mensaje: `¿Desea desactivar la categoría «${c.nombre}»?${
                        c.cuestionarios > 0 ? ` También se desactivarán sus cuestionarios (${c.cuestionarios}).` : ''
                      }`,
                    }}
                  />
                ) : (
                  <View />
                )}
                <Fila>
                  <BotonIcono icono={Pencil} etiqueta="Editar" onPress={() => setEditando(c)} />
                  <BotonIcono icono={Trash2} etiqueta="Eliminar" variante="peligro" onPress={() => setBorrando(c)} />
                </Fila>
              </Fila>
            </Tarjeta>
          ))}
          <Paginacion {...paginado} />
        </>
      )}

      {editando && (
        <FormularioCategoria
          categoria={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(categoria, esNueva) => {
            setCategorias((lista) => ordenar(esNueva ? [...lista, categoria] : lista.map((c) => (c.id === categoria.id ? categoria : c))))
            setEditando(null)
            avisar(esNueva ? `La categoría «${categoria.nombre}» fue creada.` : 'Los cambios se guardaron correctamente.')
          }}
        />
      )}

      {borrando && (
        <Confirmacion
          titulo="Eliminar categoría"
          textoConfirmar="Eliminar"
          onConfirmar={borrar}
          error={errorBorrar}
          onCerrar={() => {
            setBorrando(null)
            setErrorBorrar('')
          }}
        >
          {`¿Desea eliminar la categoría «${borrando.nombre}»? Esta acción no se puede deshacer.`}
        </Confirmacion>
      )}
    </Pagina>
  )
}
