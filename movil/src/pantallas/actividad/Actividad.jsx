import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Eye, EyeOff, SlidersHorizontal } from 'lucide-react-native'
import { obtenerHistorial } from '../../api/usuarios'
import { MARCA, useTema } from '../../tema/tema'
import { Boton, Encabezado, Esqueleto, Fila, Pagina, Paginacion, POR_PAGINA, Selector, SelectorFecha, Tarjeta, Texto, TextoError, VacioTarjeta, Text } from '../../ui'

// Historial de actividad de la campaña activa: cada movimiento registrado en el
// log de Django (fecha, hora, quién, qué hizo y, si editó, el valor anterior y el nuevo).
const ACCIONES = {
  crear: { texto: 'Creó', color: '#1f8a5b' },
  editar: { texto: 'Editó', color: MARCA.naranja },
  borrar: { texto: 'Eliminó', color: MARCA.rojo },
  sesion: { texto: 'Sesión', color: MARCA.celeste },
}
const FILTROS_VACIOS = { usuario: '', accion: '', seccion: '', desde: '', hasta: '' }

const formatoDia = (iso) => new Date(iso).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const formatoHora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const valor = (v) => (v === '' || v == null ? '(vacío)' : String(v))

function Movimiento({ m }) {
  const { c } = useTema()
  const [abierto, setAbierto] = useState(false)
  const accion = ACCIONES[m.accion] ?? ACCIONES.editar
  const hayCambios = m.cambios.length > 0
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ alignItems: 'center', width: 64 }}>
        <Texto estilo="chico">{formatoHora(m.fecha)}</Texto>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accion.color, marginTop: 4 }} />
        <View style={{ flex: 1, width: 2, backgroundColor: c.linea }} />
      </View>
      <View style={{ flex: 1, paddingBottom: 14, gap: 4 }}>
        <Text style={{ color: c.texto, lineHeight: 21 }}>
          <Text style={{ fontWeight: '800' }}>{m.usuario.nombre}</Text> <Text style={{ color: accion.color, fontWeight: '800' }}>{accion.texto}</Text>{' '}
          {m.accion !== 'sesion' ? (
            <>
              <Text style={{ color: c.gris }}>{m.seccion}</Text> <Text style={{ fontWeight: '700' }}>{m.objeto}</Text>
            </>
          ) : (
            <Text>{m.detalle}</Text>
          )}
        </Text>
        {m.detalle && m.accion !== 'sesion' ? <Texto estilo="suave">{m.detalle}</Texto> : null}
        {m.desde_admin ? <Texto estilo="chico">Realizado desde el administrador de Django.</Texto> : null}
        {hayCambios && (
          <>
            <Pressable onPress={() => setAbierto((a) => !a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }} accessibilityState={{ expanded: abierto }}>
              {abierto ? <EyeOff size={15} color={c.violetaTexto} /> : <Eye size={15} color={c.violetaTexto} />}
              <Text style={{ color: c.violetaTexto, fontWeight: '700' }}>
                {abierto ? 'Ocultar cambios' : `Ver ${m.cambios.length === 1 ? 'el cambio' : `los ${m.cambios.length} cambios`}`}
              </Text>
            </Pressable>
            {abierto && (
              <ScrollView horizontal style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 8 }}>
                <View>
                  <View style={{ flexDirection: 'row', backgroundColor: c.superficie2 }}>
                    {['Campo', 'Antes', 'Después'].map((t) => (
                      <Text key={t} style={{ width: 150, padding: 8, fontWeight: '800', color: c.texto }}>
                        {t}
                      </Text>
                    ))}
                  </View>
                  {m.cambios.map((x) => (
                    <View key={x.campo} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.linea }}>
                      <Text style={{ width: 150, padding: 8, fontWeight: '700', color: c.texto }}>{x.campo}</Text>
                      <Text style={{ width: 150, padding: 8, color: c.rojoTexto }}>{valor(x.antes)}</Text>
                      <Text style={{ width: 150, padding: 8, color: c.verdeTexto }}>{valor(x.despues)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </>
        )}
      </View>
    </View>
  )
}

export default function Actividad({ usuario }) {
  const { c } = useTema()
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [verFiltros, setVerFiltros] = useState(false)
  const clave = JSON.stringify({ ...filtros, pagina })
  const [claveCargada, setClaveCargada] = useState(null)
  const cargando = claveCargada !== clave

  useEffect(() => {
    let vigente = true
    const t = setTimeout(() => {
      obtenerHistorial(JSON.parse(clave))
        .then((d) => {
          if (!vigente) return
          setDatos(d)
          setClaveCargada(clave)
        })
        .catch((e) => vigente && setError(e.message))
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [clave])

  const cambiar = (campo) => (v) => {
    setFiltros((f) => ({ ...f, [campo]: v === null || v === undefined ? '' : String(v) }))
    setPagina(1)
  }
  const hayFiltros = Object.values(filtros).some(Boolean)

  // Agrupa por día
  const dias = []
  for (const m of datos?.movimientos ?? []) {
    const dia = formatoDia(m.fecha)
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, movimientos: [] })
    dias.at(-1).movimientos.push(m)
  }

  return (
    <Pagina alRefrescar={() => obtenerHistorial(JSON.parse(clave)).then(setDatos)}>
      <Encabezado titulo="Actividad" descripcion={`Movimientos realizados en ${usuario.campana?.nombre ?? 'la campaña'}: quién, cuándo y qué cambió.`} />

      <Fila>
        <Boton titulo={verFiltros ? 'Ocultar filtros' : 'Filtros'} icono={SlidersHorizontal} variante="borde" onPress={() => setVerFiltros((v) => !v)} />
        {hayFiltros && (
          <Boton
            titulo="Limpiar filtros"
            variante="borde"
            onPress={() => {
              setFiltros(FILTROS_VACIOS)
              setPagina(1)
            }}
          />
        )}
      </Fila>
      {verFiltros && (
        <Tarjeta>
          <Selector
            etiqueta="Persona"
            valor={filtros.usuario}
            onCambio={cambiar('usuario')}
            opciones={[{ valor: '', texto: 'Todas' }, ...(datos?.filtros.usuarios ?? []).map((u) => ({ valor: String(u.id), texto: u.nombre }))]}
          />
          <Selector
            etiqueta="Acción"
            valor={filtros.accion}
            onCambio={cambiar('accion')}
            opciones={[
              { valor: '', texto: 'Todas' },
              { valor: 'crear', texto: 'Creó' },
              { valor: 'editar', texto: 'Editó' },
              { valor: 'borrar', texto: 'Eliminó' },
              { valor: 'sesion', texto: 'Inicio / cierre de sesión' },
            ]}
          />
          <Selector
            etiqueta="Sección"
            valor={filtros.seccion}
            onCambio={cambiar('seccion')}
            opciones={[{ valor: '', texto: 'Todas' }, ...(datos?.filtros.secciones ?? []).map((s) => ({ valor: String(s.id), texto: s.nombre }))]}
          />
          <Fila gap={10}>
            <SelectorFecha style={{ flex: 1 }} etiqueta="Desde" valor={filtros.desde} onCambio={cambiar('desde')} />
            <SelectorFecha style={{ flex: 1 }} etiqueta="Hasta" valor={filtros.hasta} onCambio={cambiar('hasta')} />
          </Fila>
        </Tarjeta>
      )}

      <TextoError>{error}</TextoError>

      {!datos ? (
        !error && <Esqueleto filas={4} />
      ) : datos.total === 0 ? (
        <VacioTarjeta>{hayFiltros ? 'No hay movimientos con esos filtros.' : 'Todavía no hay movimientos.'}</VacioTarjeta>
      ) : (
        <View style={{ opacity: cargando ? 0.5 : 1, gap: 10 }}>
          <Texto estilo="suave">
            {datos.total} movimiento{datos.total === 1 ? '' : 's'}
          </Texto>
          {dias.map((d) => (
            <Tarjeta key={d.dia} style={{ gap: 10 }}>
              <Text style={{ color: c.violetaTexto, fontWeight: '800', textTransform: 'capitalize' }}>{d.dia}</Text>
              {d.movimientos.map((m) => (
                <Movimiento key={m.id} m={m} />
              ))}
            </Tarjeta>
          ))}
          <Paginacion pagina={datos.pagina} paginas={datos.paginas} total={datos.total} porPagina={POR_PAGINA} irA={setPagina} />
        </View>
      )}
    </Pagina>
  )
}
