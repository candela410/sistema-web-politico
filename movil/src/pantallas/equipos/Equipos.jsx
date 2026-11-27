import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { Pencil } from 'lucide-react-native'
import * as api from '../../api/equipos'
import { MARCA, useTema } from '../../tema/tema'
import {
  Acciones,
  AvisoOk,
  Boton,
  BotonIcono,
  Buscador,
  Casilla,
  Encabezado,
  Entrada,
  Esqueleto,
  Etiqueta,
  Fila,
  Interruptor,
  Modal,
  Pagina,
  Paginacion,
  Selector,
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

function FormularioEquipo({ equipo, rutas, disponibles, onGuardado, onCerrar }) {
  const { c } = useTema()
  const [nombre, setNombre] = useState(equipo?.nombre ?? '')
  const [ruta, setRuta] = useState(equipo?.ruta ? String(equipo.ruta) : '')
  const [elegidos, setElegidos] = useState(() => (equipo?.usuarios ?? []).map((u) => u.id))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, ruta, elegidos: [...elegidos].sort() })

  // Los que ya están en este equipo más los que no tienen equipo
  const opciones = [...(equipo?.usuarios ?? []), ...disponibles]
  const alternar = (id) => setElegidos((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]))

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre, ruta: Number(ruta), usuarios: elegidos }
      const guardado = equipo ? await api.editarEquipo(equipo.id, datos) : await api.crearEquipo(datos)
      onGuardado(guardado, !equipo)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={equipo ? 'Editar equipo' : 'Nuevo equipo'} onCerrar={onCerrar}>
      <Entrada etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej.: Equipo Norte" maxLength={120} autoCapitalize="sentences" autoFocus />
      <Selector
        etiqueta="Ruta"
        valor={ruta}
        onCambio={(v) => setRuta(String(v))}
        placeholder="Seleccione una ruta"
        disabled={rutas.length === 0}
        opciones={rutas.map((r) => ({ valor: String(r.id), texto: r.nombre }))}
      />
      {rutas.length === 0 && (
        <Texto estilo="chico" style={{ marginTop: -6, marginBottom: 10 }}>
          Para crear un equipo primero debe existir una ruta en esta campaña. Las rutas se crean desde el Mapa.
        </Texto>
      )}
      <Texto estilo="etiqueta">Usuarios</Texto>
      <View style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 10, padding: 8, marginBottom: 6 }}>
        {opciones.length === 0 ? (
          <Texto estilo="chico">No hay usuarios disponibles para asignar.</Texto>
        ) : (
          opciones.map((u) => (
            <Casilla key={u.id} marcada={elegidos.includes(u.id)} onCambio={() => alternar(u.id)}>
              <Texto>{u.nombre}</Texto>
              <Texto estilo="chico">{u.email}</Texto>
            </Casilla>
          ))
        )}
      </View>
      {opciones.length > 0 && (
        <Texto estilo={elegidos.length ? 'chico' : 'error'}>
          {elegidos.length === 0 ? 'Seleccione al menos un usuario.' : elegidos.length === 1 ? '1 usuario seleccionado.' : `${elegidos.length} usuarios seleccionados.`}
        </Texto>
      )}
      <TextoError>{error}</TextoError>
      <Acciones onCancelar={onCerrar}>
        <Boton
          titulo={guardando ? 'Guardando…' : equipo ? 'Guardar cambios' : 'Crear equipo'}
          onPress={guardar}
          cargando={guardando}
          disabled={!nombre.trim() || !ruta || elegidos.length === 0 || !conCambios}
        />
      </Acciones>
    </Modal>
  )
}

export default function Equipos({ usuario }) {
  const { c } = useTema()
  const [equipos, setEquipos] = useState(null)
  const [rutas, setRutas] = useState([])
  const [disponibles, setDisponibles] = useState([])
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [aviso, avisar] = useAviso(3000)
  const [errorAccion, setErrorAccion] = useState('')

  const puedeCrear = tiene(usuario, 'core.add_equipo')
  const puedeEditar = tiene(usuario, 'core.change_equipo')

  // Se vuelve a llamar al guardar, porque asignar usuarios cambia quiénes quedan disponibles
  const cargar = useCallback(
    () =>
      api
        .obtenerEquipos()
        .then((r) => {
          setEquipos(r.equipos)
          setRutas(r.rutas)
          setDisponibles(r.usuarios_disponibles)
        })
        .catch((e) => setErrorCarga(e.message)),
    [],
  )
  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    if (!equipos || !texto) return equipos ?? []
    return equipos.filter(
      (e) => normalizar(e.nombre).includes(texto) || normalizar(e.ruta_nombre).includes(texto) || e.usuarios.some((u) => normalizar(u.nombre).includes(texto)),
    )
  }, [equipos, busqueda])
  const paginado = usePaginado(visibles)

  async function cambiarEstado(equipo) {
    setErrorAccion('')
    try {
      const guardado = await api.editarEquipo(equipo.id, { activo: !equipo.activo })
      setEquipos((lista) => lista.map((x) => (x.id === guardado.id ? guardado : x)))
      avisar(guardado.activo ? `El equipo «${guardado.nombre}» fue activado.` : `El equipo «${guardado.nombre}» fue desactivado.`)
    } catch (e) {
      setErrorAccion(e.message)
    }
  }

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado
        titulo="Equipos"
        descripcion="Equipos de trabajo y la ruta que recorre cada uno."
        accion={puedeCrear ? '+ Nuevo equipo' : null}
        onAccion={() => setEditando('nuevo')}
      />
      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, ruta o usuario" etiqueta="Buscar equipos" />
      <AvisoOk>{aviso}</AvisoOk>
      <TextoError>{errorAccion}</TextoError>

      {errorCarga ? (
        <TextoError>{errorCarga}</TextoError>
      ) : equipos === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        equipos.length === 0 ? (
          <VacioTarjeta titulo="Todavía no hay equipos.">{puedeCrear ? 'Cree el primero con «+ Nuevo equipo».' : null}</VacioTarjeta>
        ) : (
          <VacioTarjeta>No hay equipos que coincidan con «{busqueda}».</VacioTarjeta>
        )
      ) : (
        <>
          {paginado.items.map((e) => (
            <Tarjeta key={e.id} apagada={!e.activo} style={{ gap: 8, borderLeftWidth: 4, borderLeftColor: MARCA.naranja }}>
              <Texto estilo="subtitulo">{e.nombre}</Texto>
              <Fila envolver>
                <Etiqueta color={e.ruta ? 'celeste' : 'gris'}>{e.ruta_nombre ? `Ruta: ${e.ruta_nombre}` : 'Sin ruta'}</Etiqueta>
                {!e.activo && <Etiqueta color="rojo">Desactivado</Etiqueta>}
              </Fila>
              <Texto estilo="suave">
                {e.usuarios.length === 0
                  ? 'Sin usuarios asignados'
                  : `${e.usuarios.length === 1 ? 'Usuario' : 'Usuarios'}: ${e.usuarios.map((u) => u.nombre).join(', ')}`}
              </Texto>
              {puedeEditar && (
                <Fila style={{ justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.linea, paddingTop: 8 }}>
                  <Interruptor
                    activo={e.activo}
                    onCambiar={() => cambiarEstado(e)}
                    etiqueta={`Equipo ${e.nombre} activo`}
                    confirmacion={{ titulo: 'Desactivar equipo', mensaje: `¿Desea desactivar el equipo «${e.nombre}»?` }}
                  />
                  <BotonIcono icono={Pencil} etiqueta="Editar" onPress={() => setEditando(e)} />
                </Fila>
              )}
            </Tarjeta>
          ))}
          <Paginacion {...paginado} />
        </>
      )}

      {editando && (
        <FormularioEquipo
          equipo={editando === 'nuevo' ? null : editando}
          rutas={rutas}
          disponibles={disponibles}
          onCerrar={() => setEditando(null)}
          onGuardado={async (equipo, esNuevo) => {
            setEditando(null)
            await cargar()
            avisar(esNuevo ? `El equipo «${equipo.nombre}» fue creado.` : 'Los cambios se guardaron correctamente.')
          }}
        />
      )}
    </Pagina>
  )
}
