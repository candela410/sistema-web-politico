import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Pencil, Trash2, Undo2 } from 'lucide-react-native'
import * as api from '../../api/mapa'
import { MARCA, useTema } from '../../tema/tema'
import { Acciones, Boton, BotonIcono, Confirmacion, Entrada, Fila, Paginacion, Selector, Texto, usePaginado, Text } from '../../ui'
import { useConCambios } from '../../util/validaciones'
import { PERFILES, distancia, duracion } from './formato'

// Agrupa las rutas por zona. Una ruta que pasa por dos zonas aparece en las dos; las que no pasan por ninguna, al final.
function porZona(rutas) {
  const grupos = new Map()
  for (const r of rutas) {
    for (const zona of r.zonas.length ? r.zonas : [null]) {
      if (!grupos.has(zona)) grupos.set(zona, [])
      grupos.get(zona).push(r)
    }
  }
  return [...grupos].sort(([a], [b]) => (a === null) - (b === null) || String(a).localeCompare(String(b)))
}

function FormularioRuta({ modo, setModo, form, cambiar, guardando, onGuardar }) {
  const { c } = useTema()
  const conCambios = useConCambios({ ...form, paradas: modo.paradas })
  const quitar = (i) => setModo((m) => ({ ...m, paradas: m.paradas.filter((_, j) => j !== i) }))
  const faltan = Math.max(0, 2 - modo.paradas.length)
  return (
    <View>
      <Texto estilo="subtitulo" style={{ marginBottom: 6 }}>
        {modo.id ? 'Editar ruta' : 'Nueva ruta'}
      </Texto>
      <Texto style={{ backgroundColor: c.superficie2, padding: 10, borderRadius: 10, marginBottom: 8 }}>
        Toque el mapa para marcar, en orden, los puntos por donde pasa la ruta. Mantenga apretado un punto para moverlo.
      </Texto>
      {modo.paradas.map(([lng, lat], i) => (
        <Fila key={`${i}-${lng}-${lat}`} style={{ paddingVertical: 4 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: MARCA.violeta, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{i + 1}</Text>
          </View>
          <Texto estilo="chico" style={{ flex: 1 }}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Texto>
          <Text onPress={() => quitar(i)} style={{ color: c.rojoTexto, fontWeight: '700', padding: 4 }} accessibilityLabel={`Quitar punto ${i + 1}`}>
            Quitar
          </Text>
        </Fila>
      ))}
      {modo.paradas.length > 0 && (
        <Boton chico variante="borde" icono={Undo2} titulo="Quitar el último" onPress={() => quitar(modo.paradas.length - 1)} style={{ alignSelf: 'flex-start', marginVertical: 6 }} />
      )}
      {faltan > 0 && <Texto estilo="chico" style={{ marginBottom: 8 }}>{faltan === 2 ? 'Faltan al menos 2 puntos.' : 'Falta al menos 1 punto.'}</Texto>}
      <Entrada etiqueta="Nombre" value={form.nombre} onChangeText={cambiar('nombre')} placeholder="Ej.: Recorrido del sábado" maxLength={120} autoCapitalize="sentences" />
      <Selector etiqueta="Cómo se recorre" valor={form.perfil} onCambio={cambiar('perfil')} opciones={PERFILES.map(([valor, texto]) => ({ valor, texto }))} />
      <Entrada etiqueta="Notas" value={form.descripcion} onChangeText={cambiar('descripcion')} maxLength={500} multiline />
      <Acciones onCancelar={() => setModo(null)}>
        <Boton titulo={guardando ? 'Calculando…' : 'Calcular y guardar'} onPress={onGuardar} cargando={guardando} disabled={faltan > 0 || !form.nombre.trim() || !conCambios} />
      </Acciones>
    </View>
  )
}

export default function PanelRutas({ rutas, modo, setModo, seleccionada, onSeleccionar, onGuardada, onBorrada, onError, puedeCrear, puedeEditar, puedeBorrar }) {
  const { c } = useTema()
  const [form, setForm] = useState({ nombre: '', perfil: 'foot-walking', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState(null)
  const rutaActiva = rutas.find((r) => r.id === seleccionada)
  const marcando = modo?.tipo === 'ruta'
  const cambiar = (campo) => (v) => setForm((f) => ({ ...f, [campo]: v }))
  const paginado = usePaginado(rutas)

  function empezar(ruta) {
    setForm({ nombre: ruta?.nombre ?? '', perfil: ruta?.perfil ?? 'foot-walking', descripcion: ruta?.descripcion ?? '' })
    setModo({ tipo: 'ruta', id: ruta?.id, paradas: ruta?.paradas ?? [] })
  }

  async function guardar() {
    setGuardando(true)
    onError('')
    const datos = { ...form, paradas: modo.paradas }
    try {
      const ruta = modo.id ? await api.editarRuta(modo.id, datos) : await api.crearRuta(datos)
      onGuardada(ruta, !modo.id)
      setModo(null)
    } catch (e) {
      onError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(ruta) {
    setABorrar(null)
    try {
      await api.borrarRuta(ruta.id)
      onBorrada(ruta.id)
    } catch (e) {
      onError(e.message)
    }
  }

  if (marcando) return <FormularioRuta modo={modo} setModo={setModo} form={form} cambiar={cambiar} guardando={guardando} onGuardar={guardar} />

  const dato = (etiqueta, valor) => (
    <Fila style={{ alignItems: 'flex-start' }}>
      <Texto estilo="chico" style={{ width: 110 }}>
        {etiqueta}
      </Texto>
      <Texto style={{ flex: 1 }}>{valor}</Texto>
    </Fila>
  )

  return (
    <View style={{ gap: 8 }}>
      {puedeCrear && <Boton titulo="+ Nueva ruta" onPress={() => empezar(null)} />}
      {rutas.length === 0 ? (
        <Texto estilo="suave">Todavía no hay rutas. Cree una marcando los puntos sobre el mapa.</Texto>
      ) : (
        <>
          {porZona(paginado.items).map(([zona, lista]) => (
            <View key={zona ?? 'sin-zona'} style={{ gap: 6 }}>
              <Text style={{ color: c.gris, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 }}>{zona ? `Zona ${zona}` : 'Sin zona'}</Text>
              {lista.map((r) => {
                const activa = r.id === seleccionada
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => onSeleccionar(r)}
                    accessibilityState={{ selected: activa }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: activa ? MARCA.magenta : c.linea,
                      backgroundColor: activa ? c.fondoMagenta : c.superficie,
                    }}
                  >
                    <View style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: MARCA.magenta }} />
                    <View style={{ flex: 1 }}>
                      <Texto estilo="negrita">{r.nombre}</Texto>
                      <Texto estilo="chico">
                        {distancia(r.distancia_m)} · {duracion(r.duracion_s)} · {PERFILES.find(([v]) => v === r.perfil)?.[1].toLowerCase()}
                      </Texto>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ))}
          <Paginacion {...paginado} />
        </>
      )}
      {rutaActiva && (
        <View style={{ borderTopWidth: 1, borderColor: c.linea, paddingTop: 10, gap: 6 }}>
          <Texto estilo="subtitulo">{rutaActiva.nombre}</Texto>
          {dato('Distancia', distancia(rutaActiva.distancia_m))}
          {dato('Tiempo estimado', duracion(rutaActiva.duracion_s))}
          {dato(rutaActiva.zonas.length === 1 ? 'Zona' : 'Zonas', rutaActiva.zonas.length ? rutaActiva.zonas.join(', ') : 'Sin zona')}
          {dato('Calles', rutaActiva.calles)}
          {dato('Puntos', rutaActiva.paradas.length)}
          {rutaActiva.equipos.length > 0 && dato('Equipos', rutaActiva.equipos.join(', '))}
          {rutaActiva.descripcion ? <Texto estilo="suave">{rutaActiva.descripcion}</Texto> : null}
          <Fila>
            {puedeEditar && <BotonIcono icono={Pencil} etiqueta="Editar ruta" onPress={() => empezar(rutaActiva)} />}
            {puedeBorrar && <BotonIcono icono={Trash2} etiqueta="Eliminar ruta" variante="peligro" onPress={() => setABorrar(rutaActiva)} />}
          </Fila>
        </View>
      )}
      {aBorrar && (
        <Confirmacion titulo="Eliminar ruta" textoConfirmar="Eliminar" onCerrar={() => setABorrar(null)} onConfirmar={() => borrar(aBorrar)}>
          {`¿Desea eliminar la ruta «${aBorrar.nombre}»?`}
        </Confirmacion>
      )}
    </View>
  )
}
