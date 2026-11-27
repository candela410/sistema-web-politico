import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowRight, Pencil, Plus } from 'lucide-react-native'
import * as api from '../../api/campanas'
import { MARCA, useTema } from '../../tema/tema'
import {
  Text,
  estiloTarjeta,
  Acciones,
  Boton,
  BotonIcono,
  Entrada,
  Fila,
  Franja,
  InterruptorCampo,
  Modal,
  Paginacion,
  Tarjeta,
  Texto,
  TextoError,
  VacioTarjeta,
  usePaginado,
} from '../../ui'
import { tiene } from '../../util/permisos'
import { useConCambios } from '../../util/validaciones'

// Crear o editar una campaña (nombre, descripción y si está activa)
function FormularioCampana({ campana, onGuardada, onCerrar }) {
  const [form, setForm] = useState({
    nombre: campana?.nombre ?? '',
    descripcion: campana?.descripcion ?? '',
    activa: campana?.activa ?? true,
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios(form)
  const cambiar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }))

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      onGuardada(campana ? await api.editarCampana(campana.id, form) : await api.crearCampana(form))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={campana ? 'Editar campaña' : 'Nueva campaña'} onCerrar={onCerrar}>
      <Entrada etiqueta="Nombre" value={form.nombre} onChangeText={cambiar('nombre')} maxLength={150} autoCapitalize="sentences" autoFocus />
      <Entrada etiqueta="Descripción" value={form.descripcion} onChangeText={cambiar('descripcion')} maxLength={500} multiline />
      <InterruptorCampo valor={form.activa} onCambio={cambiar('activa')}>
        Activa
      </InterruptorCampo>
      <TextoError>{error}</TextoError>
      <Acciones onCancelar={onCerrar}>
        <Boton
          titulo={guardando ? 'Guardando…' : campana ? 'Guardar cambios' : 'Crear campaña'}
          onPress={guardar}
          cargando={guardando}
          disabled={!form.nombre.trim() || !conCambios}
        />
      </Acciones>
    </Modal>
  )
}

const resumen = (c) =>
  `${c.cuestionarios} cuestionario${c.cuestionarios === 1 ? '' : 's'} · ${c.usuarios} usuario${
    c.usuarios === 1 ? '' : 's'
  } · ${c.rutas} ruta${c.rutas === 1 ? '' : 's'}`

// Pantalla que ve quien puede elegir la campaña después de ingresar. Acá mismo
// se crean campañas nuevas y se activan o desactivan.
export default function ElegirCampana({ usuario, onElegida, onSalir }) {
  const { c } = useTema()
  const insets = useSafeAreaInsets()
  const [campanas, setCampanas] = useState(null)
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(null)
  const [editando, setEditando] = useState(null) // null | 'nueva' | campaña
  const puedeCrear = tiene(usuario, 'core.add_campana')
  const puedeEditar = tiene(usuario, 'core.change_campana')

  useEffect(() => {
    api
      .obtenerCampanas()
      .then(setCampanas)
      .catch((e) => setError(e.message))
  }, [])

  const activas = (campanas ?? []).filter((x) => x.activa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const inactivas = (campanas ?? []).filter((x) => !x.activa).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const paginado = usePaginado(activas)

  async function entrar(campana) {
    setError('')
    setEntrando(campana.id)
    try {
      onElegida(await api.elegirCampana(campana.id))
    } catch (e) {
      setError(e.message)
      setEntrando(null)
    }
  }

  function guardada(campana) {
    setCampanas((lista) => {
      const sin = (lista ?? []).filter((x) => x.id !== campana.id)
      const anterior = (lista ?? []).find((x) => x.id === campana.id)
      // Al crear o editar, el servidor no manda los conteos: se conservan los que había
      return [...sin, { cuestionarios: 0, usuarios: 0, rutas: 0, ...anterior, ...campana }]
    })
    setEditando(null)
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fondo }}>
      <StatusBar style="light" />
      {/* Cabecera violeta del desarrollo móvil */}
      <View style={{ backgroundColor: MARCA.violeta, paddingTop: insets.top + 10, paddingBottom: 22, paddingHorizontal: 20, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: 10 }}>
          <Fila gap={12}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../../../assets/img/logo.png')} style={{ width: 44, height: 36 }} resizeMode="contain" accessibilityLabel="Logo" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }} titulo accessibilityRole="header">
                Seleccione la campaña
              </Text>
              <Text style={{ color: MARCA.violetaClaro, fontSize: 13 }}>Bienvenido/a, {usuario.nombre || usuario.email}</Text>
            </View>
            <Franja ancho={48} />
          </Fila>
        </View>
      </View>
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
          <Texto estilo="suave">Seleccione la campaña en la que va a trabajar: se mostrarán solo sus datos.</Texto>
          {puedeCrear && <Boton titulo="Nueva campaña" icono={Plus} onPress={() => setEditando('nueva')} grande />}
          <TextoError>{error}</TextoError>

          {campanas === null ? (
            <VacioTarjeta>Cargando…</VacioTarjeta>
          ) : activas.length === 0 ? (
            <VacioTarjeta titulo="No hay campañas activas.">
              {puedeCrear ? 'Cree una campaña para comenzar.' : 'Solicite a la administración que cree una.'}
            </VacioTarjeta>
          ) : (
            <>
              {paginado.items.map((x) => (
                <Fila key={x.id} gap={8} style={{ alignItems: 'stretch' }}>
                  <Pressable
                    onPress={() => entrar(x)}
                    disabled={entrando !== null}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      flex: 1,
                      ...estiloTarjeta(c),
                      borderLeftWidth: 4,
                      borderLeftColor: pressed ? MARCA.magenta : MARCA.violeta,
                      padding: 16,
                      gap: 4,
                      opacity: entrando !== null && entrando !== x.id ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ color: c.texto, fontSize: 17, fontWeight: '800' }}>{x.nombre}</Text>
                    {x.descripcion ? <Texto estilo="suave">{x.descripcion}</Texto> : null}
                    <Texto estilo="chico">{resumen(x)}</Texto>
                    <Fila gap={4} style={{ marginTop: 6 }}>
                      <Text style={{ color: c.violetaTexto, fontWeight: '700' }}>{entrando === x.id ? 'Ingresando…' : 'Ingresar'}</Text>
                      {entrando !== x.id && <ArrowRight size={16} color={c.violetaTexto} />}
                    </Fila>
                  </Pressable>
                  {puedeEditar && <BotonIcono icono={Pencil} etiqueta={`Editar ${x.nombre}`} ayuda="Editar o desactivar" onPress={() => setEditando(x)} />}
                </Fila>
              ))}
              <Paginacion {...paginado} />
            </>
          )}

          {inactivas.length > 0 && (
            <Tarjeta style={{ gap: 10 }}>
              <Texto estilo="subtitulo">Campañas desactivadas</Texto>
              {inactivas.map((x) => (
                <Fila key={x.id} style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Texto estilo="negrita">{x.nombre}</Texto>
                    <Texto estilo="chico">{resumen(x)}</Texto>
                  </View>
                  {puedeEditar && <Boton titulo="Editar" variante="borde" chico onPress={() => setEditando(x)} />}
                </Fila>
              ))}
            </Tarjeta>
          )}

          <Text onPress={onSalir} style={{ color: c.violetaTexto, fontWeight: '700', textAlign: 'center', padding: 14 }} accessibilityRole="button">
            Cerrar sesión
          </Text>
        </ScrollView>
      </SafeAreaView>

      {editando && <FormularioCampana campana={editando === 'nueva' ? null : editando} onGuardada={guardada} onCerrar={() => setEditando(null)} />}
    </View>
  )
}
