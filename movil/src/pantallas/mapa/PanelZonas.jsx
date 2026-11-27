import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Check, Pencil, Trash2, Undo2 } from 'lucide-react-native'
import * as api from '../../api/mapa'
import { MARCA, useTema } from '../../tema/tema'
import { Acciones, Boton, BotonIcono, Confirmacion, Entrada, Fila, Paginacion, Texto, usePaginado, Text } from '../../ui'
import { COLORES_ZONA } from './formato'
import { poligonoGeoJSON } from './geo'

function SelectorColor({ valor, onCambio }) {
  return (
    <Fila gap={8} envolver accessibilityRole="radiogroup" accessibilityLabel="Color de la zona" style={{ marginBottom: 10 }}>
      {COLORES_ZONA.map((color) => (
        <Pressable
          key={color}
          onPress={() => onCambio(color)}
          accessibilityRole="radio"
          accessibilityState={{ checked: valor === color }}
          accessibilityLabel={color}
          style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, borderWidth: valor === color ? 3 : 0, borderColor: '#15121c', alignItems: 'center', justifyContent: 'center' }}
        >
          {valor === color && <Check size={16} color="#fff" strokeWidth={3} />}
        </Pressable>
      ))}
    </Fila>
  )
}

// Rutas que pasan por cada zona (rutas → calles → barrios → zonas)
const rutasDe = (zona, rutas) => rutas.filter((r) => r.zonas.includes(zona.nombre)).map((r) => r.nombre)

export default function PanelZonas({ zonas, rutas, modo, setModo, seleccionada, onSeleccionar, onGuardada, onBorrada, onError, puedeCrear, puedeEditar, puedeBorrar }) {
  const { c } = useTema()
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_ZONA[0])
  const [guardando, setGuardando] = useState(false)
  const [inicial, setInicial] = useState('')
  const [aBorrar, setABorrar] = useState(null)
  const paginado = usePaginado(zonas)
  const zonaActiva = zonas.find((z) => z.id === seleccionada)
  const creando = modo?.tipo === 'zona-nueva'
  const editando = modo?.tipo === 'zona-editar'

  function empezarNueva() {
    setNombre('')
    setColor(COLORES_ZONA[zonas.length % COLORES_ZONA.length])
    setModo({ tipo: 'zona-nueva', puntos: [] })
  }

  function empezarEdicion(zona) {
    setNombre(zona.nombre)
    setColor(zona.color)
    setInicial(JSON.stringify([zona.nombre, zona.color, zona.geometria]))
    setModo({ tipo: 'zona-editar', id: zona.id, geometria: zona.geometria })
  }

  async function guardar() {
    setGuardando(true)
    onError('')
    try {
      const datos = { nombre, color, geometria: modo.geometria }
      if (creando) onGuardada(await api.crearZona(datos), true)
      else onGuardada(await api.editarZona(modo.id, datos), false)
      setModo(null)
    } catch (e) {
      onError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(zona) {
    setABorrar(null)
    try {
      await api.borrarZona(zona.id)
      onBorrada(zona.id)
    } catch (e) {
      onError(e.message)
    }
  }

  if (creando || editando) {
    const hayContorno = !!modo.geometria
    const conCambios = creando || JSON.stringify([nombre.trim(), color, modo.geometria]) !== inicial
    const puntos = modo.puntos ?? []
    return (
      <View>
        <Texto estilo="subtitulo" style={{ marginBottom: 6 }}>
          {creando ? 'Nueva zona' : 'Editar zona'}
        </Texto>
        {creando && !hayContorno && (
          <View style={{ backgroundColor: c.superficie2, padding: 10, borderRadius: 10, gap: 8, marginBottom: 10 }}>
            <Texto>Toque el mapa para marcar los vértices de la zona ({puntos.length} marcados). Cuando termine, presione «Cerrar contorno».</Texto>
            <Fila gap={8}>
              <Boton
                flex
                chico
                variante="borde"
                icono={Undo2}
                titulo="Deshacer"
                disabled={!puntos.length}
                onPress={() => setModo((m) => ({ ...m, puntos: m.puntos.slice(0, -1) }))}
              />
              <Boton
                flex
                chico
                icono={Check}
                titulo="Cerrar contorno"
                disabled={puntos.length < 3}
                onPress={() => setModo((m) => ({ ...m, geometria: poligonoGeoJSON(m.puntos) }))}
              />
            </Fila>
          </View>
        )}
        {creando && hayContorno && (
          <Text style={{ color: c.verdeTexto, marginBottom: 10 }}>
            ✓ Contorno dibujado.{' '}
            <Text style={{ color: c.violetaTexto, fontWeight: '700' }} onPress={() => setModo({ tipo: 'zona-nueva', puntos: [] })}>
              Volver a dibujar
            </Text>
          </Text>
        )}
        {editando && <Texto estilo="suave" style={{ marginBottom: 10 }}>Mantenga apretado un vértice y arrástrelo en el mapa para cambiar el contorno.</Texto>}
        <Entrada etiqueta="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej.: Zona Norte" maxLength={100} autoCapitalize="sentences" />
        <Texto estilo="etiqueta">Color</Texto>
        <SelectorColor valor={color} onCambio={setColor} />
        <Texto estilo="chico">Los barrios cuyo centro quede dentro del contorno se asignan a la zona.</Texto>
        <Acciones onCancelar={() => setModo(null)}>
          <Boton titulo={guardando ? 'Guardando…' : 'Guardar zona'} onPress={guardar} cargando={guardando} disabled={!hayContorno || !nombre.trim() || !conCambios} />
        </Acciones>
      </View>
    )
  }

  return (
    <View style={{ gap: 8 }}>
      {puedeCrear && <Boton titulo="+ Nueva zona" onPress={empezarNueva} />}
      {zonas.length === 0 ? (
        <Texto estilo="suave">Todavía no hay zonas. Cree la primera dibujándola sobre el mapa.</Texto>
      ) : (
        <>
          {paginado.items.map((z) => {
            const activa = z.id === seleccionada
            const cantidadRutas = rutasDe(z, rutas).length
            return (
              <Pressable
                key={z.id}
                onPress={() => onSeleccionar(z)}
                accessibilityState={{ selected: activa }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: activa ? MARCA.violeta : c.linea,
                  backgroundColor: activa ? c.superficie2 : c.superficie,
                }}
              >
                <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: z.color }} />
                <View style={{ flex: 1 }}>
                  <Texto estilo="negrita">{z.nombre}</Texto>
                  <Texto estilo="chico">
                    {z.barrios.length === 1 ? '1 barrio' : `${z.barrios.length} barrios`} · {cantidadRutas === 1 ? '1 ruta' : `${cantidadRutas} rutas`}
                  </Texto>
                </View>
              </Pressable>
            )
          })}
          <Paginacion {...paginado} />
        </>
      )}
      {zonaActiva && (
        <View style={{ borderTopWidth: 1, borderColor: c.linea, paddingTop: 10, gap: 6 }}>
          <Texto estilo="subtitulo">{zonaActiva.nombre}</Texto>
          <Texto estilo="suave">
            {zonaActiva.barrios.length === 0
              ? 'No tiene barrios dentro.'
              : zonaActiva.barrios
                  .slice(0, 15)
                  .map((b) => b.nombre)
                  .join(', ') + (zonaActiva.barrios.length > 15 ? ` y ${zonaActiva.barrios.length - 15} más.` : '.')}
          </Texto>
          <Texto estilo="chico">Rutas</Texto>
          <Texto>{rutasDe(zonaActiva, rutas).join(', ') || 'Ninguna ruta pasa por esta zona'}</Texto>
          <Fila>
            {puedeEditar && <BotonIcono icono={Pencil} etiqueta="Editar zona" onPress={() => empezarEdicion(zonaActiva)} />}
            {puedeBorrar && <BotonIcono icono={Trash2} etiqueta="Eliminar zona" variante="peligro" onPress={() => setABorrar(zonaActiva)} />}
          </Fila>
        </View>
      )}
      {aBorrar && (
        <Confirmacion titulo="Eliminar zona" textoConfirmar="Eliminar" onCerrar={() => setABorrar(null)} onConfirmar={() => borrar(aBorrar)}>
          {`¿Desea eliminar la zona «${aBorrar.nombre}»? Sus barrios quedarán sin zona.`}
        </Confirmacion>
      )}
    </View>
  )
}
