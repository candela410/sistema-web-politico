import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { Pencil, Trash2 } from 'lucide-react-native'
import * as api from '../../api/grupos'
import { MARCA, useTema } from '../../tema/tema'
import {
  Text,
  Acciones,
  AvisoOk,
  Boton,
  BotonIcono,
  Buscador,
  Casilla,
  Confirmacion,
  Encabezado,
  Entrada,
  Esqueleto,
  Fila,
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
import { useConCambios } from '../../util/validaciones'

const ordenar = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
const ORDEN_ACCIONES = ['Ver', 'Crear', 'Editar', 'Borrar']
const posicion = (accion) => {
  const i = ORDEN_ACCIONES.indexOf(accion)
  return i === -1 ? ORDEN_ACCIONES.length : i
}

function FormularioGrupo({ grupo, onGuardado, onCerrar }) {
  const { c } = useTema()
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [seleccion, setSeleccion] = useState(new Set(grupo?.permisos ?? []))
  const [secciones, setSecciones] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, permisos: [...seleccion].sort((a, b) => a - b) })

  useEffect(() => {
    api
      .obtenerPermisos()
      .then(setSecciones)
      .catch((e) => setError(e.message))
  }, [])

  function alternar(id) {
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  function alternarSeccion(seccion) {
    const ids = seccion.permisos.map((p) => p.id)
    const todos = ids.every((id) => seleccion.has(id))
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      ids.forEach((id) => (todos ? nueva.delete(id) : nueva.add(id)))
      return nueva
    })
  }

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre: nombre.trim(), permisos: [...seleccion] }
      const guardado = grupo ? await api.editarGrupo(grupo.id, datos) : await api.crearGrupo(datos)
      onGuardado(guardado, !grupo)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={grupo ? 'Editar rol' : 'Nuevo rol'} onCerrar={onCerrar} ancho>
      <Entrada etiqueta="Nombre del rol" value={nombre} onChangeText={setNombre} placeholder="Ej.: Coordinador de zona" maxLength={120} autoFocus />
      <Texto estilo="etiqueta">Permisos ({seleccion.size})</Texto>
      {secciones === null ? (
        <Texto estilo="suave">Cargando permisos…</Texto>
      ) : (
        <View style={{ gap: 8 }}>
          {secciones.map((seccion) => {
            const permisos = [...seccion.permisos].sort((a, b) => posicion(a.accion) - posicion(b.accion))
            const todos = permisos.every((p) => seleccion.has(p.id))
            return (
              <View key={seccion.seccion} style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 10, padding: 8 }}>
                <Casilla marcada={todos} onCambio={() => alternarSeccion(seccion)}>
                  <Texto estilo="negrita">{seccion.seccion}</Texto>
                </Casilla>
                <Fila envolver gap={14} style={{ paddingLeft: 32 }}>
                  {permisos.map((permiso) => (
                    <Casilla key={permiso.id} marcada={seleccion.has(permiso.id)} onCambio={() => alternar(permiso.id)}>
                      {permiso.accion}
                    </Casilla>
                  ))}
                </Fila>
              </View>
            )
          })}
        </View>
      )}
      <TextoError>{error}</TextoError>
      <Acciones onCancelar={onCerrar}>
        <Boton titulo={guardando ? 'Guardando…' : grupo ? 'Guardar cambios' : 'Crear rol'} onPress={guardar} cargando={guardando} disabled={!nombre.trim() || !conCambios} />
      </Acciones>
    </Modal>
  )
}

export default function Grupos() {
  const { c } = useTema()
  const [grupos, setGrupos] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [errorBorrar, setErrorBorrar] = useState('')
  const [aviso, avisar] = useAviso(3000)

  const cargar = () =>
    api
      .obtenerGrupos()
      .then(setGrupos)
      .catch((e) => setErrorCarga(e.message))
  useEffect(() => {
    cargar()
  }, [])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!grupos || !texto) return grupos ?? []
    // Por nombre del rol o por nombre o correo de sus usuarios, sin distinguir acentos
    return grupos.filter((g) => normalizar(`${g.nombre} ${g.usuarios.map((u) => `${u.nombre} ${u.email}`).join(' ')}`).includes(texto))
  }, [grupos, busqueda])
  const paginado = usePaginado(visibles)

  async function borrar() {
    setErrorBorrar('')
    try {
      await api.borrarGrupo(borrando.id)
      setGrupos((lista) => lista.filter((g) => g.id !== borrando.id))
      setBorrando(null)
      avisar('El rol fue eliminado.')
    } catch (e) {
      setErrorBorrar(e.message)
    }
  }
  const cantidadBorrar = borrando?.total_usuarios ?? 0

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado
        titulo="Roles"
        descripcion="Los mismos roles que se asignan en Usuarios, con sus permisos e integrantes."
        accion="+ Nuevo rol"
        onAccion={() => setEditando('nuevo')}
      />
      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre o usuario" etiqueta="Buscar roles" />
      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <TextoError>{errorCarga}</TextoError>
      ) : grupos === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        grupos.length === 0 ? (
          <VacioTarjeta titulo="Todavía no hay roles.">Cree el primero con «+ Nuevo rol».</VacioTarjeta>
        ) : (
          <View style={{ gap: 8 }}>
            <VacioTarjeta>No hay roles que coincidan con «{busqueda}».</VacioTarjeta>
            <Boton titulo="Limpiar búsqueda" variante="borde" onPress={() => setBusqueda('')} />
          </View>
        )
      ) : (
        <>
          {paginado.items.map((g) => (
            <Tarjeta key={g.id} style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: MARCA.magenta }}>
              <Fila style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Texto estilo="subtitulo">{g.nombre}</Texto>
                  <Text style={{ color: c.violetaTexto, fontWeight: '700' }}>
                    {g.permisos.length === 0 ? 'Sin permisos' : `${g.permisos.length} permiso${g.permisos.length === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <Fila>
                  <BotonIcono icono={Pencil} etiqueta="Editar" onPress={() => setEditando(g)} />
                  <BotonIcono icono={Trash2} etiqueta="Eliminar rol" variante="peligro" onPress={() => setBorrando(g)} />
                </Fila>
              </Fila>
              <Text style={{ color: c.gris }}>
                {g.usuarios.length === 0 ? (
                  'Sin usuarios'
                ) : (
                  <>
                    {g.usuarios.length === 1 ? 'Usuario' : 'Usuarios'} ({g.usuarios.length}):{' '}
                    {g.usuarios.map((u, i) => (
                      <Text key={u.id} style={u.activo ? undefined : { textDecorationLine: 'line-through' }}>
                        {i > 0 && ', '}
                        {u.nombre}
                        {!u.activo && ' (inactivo)'}
                      </Text>
                    ))}
                  </>
                )}
              </Text>
            </Tarjeta>
          ))}
          <Paginacion {...paginado} />
        </>
      )}

      {editando && (
        <FormularioGrupo
          grupo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(grupo, esNuevo) => {
            setGrupos((lista) => ordenar(esNuevo ? [...lista, grupo] : lista.map((g) => (g.id === grupo.id ? grupo : g))))
            setEditando(null)
            avisar(esNuevo ? `El rol «${grupo.nombre}» fue creado.` : 'Los cambios se guardaron correctamente.')
          }}
        />
      )}

      {/* Si el rol tiene usuarios (de cualquier campaña) no se puede eliminar */}
      {borrando && cantidadBorrar > 0 && (
        <Modal titulo="No se puede eliminar el rol" onCerrar={() => setBorrando(null)}>
          <Texto style={{ lineHeight: 22 }}>
            El rol «{borrando.nombre}» tiene {cantidadBorrar} usuario{cantidadBorrar === 1 ? '' : 's'} asignado{cantidadBorrar === 1 ? '' : 's'}. Para
            eliminarlo, asigne otro rol a {cantidadBorrar === 1 ? 'ese usuario' : 'esos usuarios'}.
          </Texto>
          <Acciones>
            <Boton titulo="Entendido" onPress={() => setBorrando(null)} />
          </Acciones>
        </Modal>
      )}
      {borrando && cantidadBorrar === 0 && (
        <Confirmacion
          titulo="Eliminar rol"
          textoConfirmar="Eliminar"
          error={errorBorrar}
          onConfirmar={borrar}
          onCerrar={() => {
            setBorrando(null)
            setErrorBorrar('')
          }}
        >
          {`¿Desea eliminar el rol «${borrando.nombre}»? Esta acción no se puede deshacer.`}
        </Confirmacion>
      )}
    </Pagina>
  )
}
