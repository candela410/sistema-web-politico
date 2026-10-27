import './leafletGlobal'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import * as api from '../../api/mapa'
import { CapaRutas, MarcarParadas } from './CapaRutas'
import { DibujarPoligono, EditarPoligono } from './Dibujo'
import PanelRutas from './PanelRutas'
import PanelZonas from './PanelZonas'
import './mapa.css'

const CENTRO_ARGENTINA = [-34.6, -64.5]

function Encuadrar({ datos }) {
  const map = useMap()
  useEffect(() => {
    if (!datos?.features?.length) return
    const limites = L.geoJSON(datos).getBounds()
    if (limites.isValid()) map.fitBounds(limites, { padding: [20, 20] })
  }, [datos, map])
  return null
}

function IrA({ destino }) {
  const map = useMap()
  useEffect(() => {
    if (!destino) return
    const limites = L.geoJSON(destino).getBounds()
    if (limites.isValid()) map.flyToBounds(limites, { padding: [40, 40], duration: 0.6 })
  }, [destino, map])
  return null
}

function Mapa() {
  const [barrios, setBarrios] = useState(null)
  const [zonas, setZonas] = useState([])
  const [rutas, setRutas] = useState([])
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState('zonas')

  // modo: null | { tipo: 'zona-nueva', geometria? } | { tipo: 'zona-editar', id, geometria }
  //       | { tipo: 'ruta', id?, paradas }
  const [modo, setModo] = useState(null)
  const [seleccion, setSeleccion] = useState(null) // { tipo: 'zona'|'ruta'|'barrio', id }
  const [calles, setCalles] = useState(null)
  const [destino, setDestino] = useState(null)

  useEffect(() => {
    Promise.all([api.obtenerBarrios(), api.obtenerZonas(), api.obtenerRutas()])
      .then(([b, z, r]) => {
        setBarrios(b)
        setZonas(z)
        setRutas(r)
      })
      .catch((e) => setError(e.message))
  }, [])

  const recargarBarrios = useCallback(() => api.obtenerBarrios().then(setBarrios), [])

  const colorDeZona = useMemo(() => Object.fromEntries(zonas.map((z) => [z.id, z.color])), [zonas])
  const zonaSeleccionada = seleccion?.tipo === 'zona' ? seleccion.id : null

  const estiloBarrio = useCallback(
    (feature) => {
      const { zona, id } = feature.properties
      const color = colorDeZona[zona]
      const resaltado = seleccion?.tipo === 'barrio' && seleccion.id === id
      return {
        // Sin zona: contorno violeta; con zona: el color de su zona
        color: resaltado ? '#15121c' : color || '#51318f',
        weight: resaltado ? 3 : 1.6,
        opacity: color ? 0.9 : 0.7,
        fillColor: color || '#51318f',
        fillOpacity: zonaSeleccionada && zona === zonaSeleccionada ? 0.45 : color ? 0.25 : 0.07,
        // Contorno estimado (OpenStreetMap no tiene el límite real): línea punteada
        dashArray: feature.properties.aproximado ? '5 5' : null,
      }
    },
    [colorDeZona, seleccion, zonaSeleccionada],
  )

  const alHacerClicEnBarrio = useCallback(
    (feature, capa) => {
      const { nombre, aproximado } = feature.properties
      capa.bindTooltip(aproximado ? `${nombre} (límite aproximado)` : nombre, {
        sticky: true,
        className: 'mapa-tooltip',
      })
      capa.on('click', () => {
        if (modo) return
        setSeleccion({ tipo: 'barrio', id: feature.properties.id })
        api
          .obtenerCallesDeBarrio(feature.properties.id)
          .then((c) => setCalles({ barrio: feature.properties, datos: c }))
          .catch((e) => setError(e.message))
      })
    },
    [modo],
  )

  function seleccionar(tipo, item) {
    setSeleccion({ tipo, id: item.id })
    setCalles(null)
    if (item.geometria) setDestino({ ...item.geometria })
  }

  const enDibujo = modo?.tipo === 'zona-nueva' && !modo.geometria
  const marcandoRuta = modo?.tipo === 'ruta'

  return (
    <div className="mapa">
      <aside className="mapa__lateral">
        <div className="pestanas" role="tablist">
          {[
            ['zonas', `Zonas (${zonas.length})`],
            ['rutas', `Rutas (${rutas.length})`],
          ].map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={pestana === clave}
              className="pestanas__item"
              disabled={!!modo}
              onClick={() => {
                setPestana(clave)
                setSeleccion(null)
                setCalles(null)
              }}
            >
              {texto}
            </button>
          ))}
        </div>

        {error && (
          <p className="aviso aviso--error" role="alert">
            {error}{' '}
            <button type="button" className="enlace-boton" onClick={() => setError('')}>
              Cerrar
            </button>
          </p>
        )}

        {barrios && barrios.features.length === 0 && (
          <p className="aviso">
            Todavía no hay barrios cargados. Se cargan con{' '}
            <code>python manage.py importar_osm &quot;Ciudad&quot;</code>.
          </p>
        )}

        {calles && (
          <section className="tarjeta-barrio">
            <header>
              <h3>{calles.barrio.nombre}</h3>
              <button type="button" className="enlace-boton" onClick={() => { setCalles(null); setSeleccion(null) }}>
                Cerrar
              </button>
            </header>
            <p className="texto-suave">
              {calles.barrio.zona
                ? `Zona: ${zonas.find((z) => z.id === calles.barrio.zona)?.nombre ?? '—'}`
                : 'Sin zona asignada'}{' '}
              · {calles.datos.features.length} calles
            </p>
            <ul className="lista-calles">
              {calles.datos.features.map((c) => (
                <li key={c.properties.id}>{c.properties.nombre}</li>
              ))}
            </ul>
          </section>
        )}

        {pestana === 'zonas' ? (
          <PanelZonas
            zonas={zonas}
            modo={modo}
            setModo={setModo}
            seleccionada={zonaSeleccionada}
            onSeleccionar={(z) => seleccionar('zona', z)}
            onGuardada={(zona, esNueva) => {
              setZonas((zs) =>
                esNueva ? [...zs, zona].sort((a, b) => a.nombre.localeCompare(b.nombre)) : zs.map((z) => (z.id === zona.id ? zona : z)),
              )
              setSeleccion({ tipo: 'zona', id: zona.id })
              recargarBarrios()
            }}
            onBorrada={(id) => {
              setZonas((zs) => zs.filter((z) => z.id !== id))
              setSeleccion(null)
              recargarBarrios()
            }}
            onError={setError}
          />
        ) : (
          <PanelRutas
            rutas={rutas}
            zonas={zonas}
            modo={modo}
            setModo={setModo}
            seleccionada={seleccion?.tipo === 'ruta' ? seleccion.id : null}
            onSeleccionar={(r) => seleccionar('ruta', r)}
            onGuardada={(ruta, esNueva) => {
              setRutas((rs) =>
                esNueva ? [...rs, ruta].sort((a, b) => a.nombre.localeCompare(b.nombre)) : rs.map((r) => (r.id === ruta.id ? ruta : r)),
              )
              setSeleccion({ tipo: 'ruta', id: ruta.id })
            }}
            onBorrada={(id) => {
              setRutas((rs) => rs.filter((r) => r.id !== id))
              setSeleccion(null)
            }}
            onError={setError}
          />
        )}
      </aside>

      <div className="mapa__lienzo">
        {!barrios && !error && (
          <div className="mapa__cargando" role="status">
            Cargando barrios…
          </div>
        )}
        {(enDibujo || marcandoRuta) && (
          <div className="mapa__indicacion" role="status">
            {enDibujo
              ? 'Hacé clic en el mapa para marcar los vértices de la zona. Cerrá la figura haciendo clic en el primer punto.'
              : 'Hacé clic en el mapa para agregar puntos a la ruta. Podés arrastrarlos para moverlos.'}
          </div>
        )}
        <div className="mapa__leyenda" aria-label="Referencias del mapa">
          <span>
            <i className="ref ref--barrio" /> Barrio
          </span>
          <span>
            <i className="ref ref--aproximado" /> Barrio con límite aproximado
          </span>
          <span>
            <i className="ref ref--zona" /> Zona (en su color)
          </span>
          <span>
            <i className="ref ref--ruta" /> Ruta
          </span>
        </div>
        <MapContainer center={CENTRO_ARGENTINA} zoom={5} preferCanvas className="mapa__leaflet">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {barrios && (
            <GeoJSON
              key={`barrios-${barrios.features.length}-${zonas.map((z) => z.id + z.color).join()}-${!!modo}`}
              data={barrios}
              style={estiloBarrio}
              onEachFeature={alHacerClicEnBarrio}
              interactive={!modo}
            />
          )}
          {zonas
            .filter((z) => z.geometria && !(modo?.tipo === 'zona-editar' && modo.id === z.id))
            .map((z) => (
              <GeoJSON
                key={`zona-${z.id}-${z.color}-${JSON.stringify(z.geometria).length}-${zonaSeleccionada === z.id}`}
                data={z.geometria}
                interactive={false}
                style={{
                  color: z.color,
                  weight: zonaSeleccionada === z.id ? 4 : 2.5,
                  dashArray: zonaSeleccionada === z.id ? null : '6 4',
                  fill: false,
                }}
              />
            ))}
          {calles && (
            <GeoJSON
              key={`calles-${calles.barrio.id}`}
              data={calles.datos}
              interactive={false}
              style={{ color: '#15121c', weight: 3, opacity: 0.75 }}
            />
          )}
          <CapaRutas
            rutas={rutas}
            seleccionada={seleccion?.tipo === 'ruta' ? seleccion.id : null}
            ocultar={modo?.tipo === 'ruta' ? modo.id : null}
          />
          {marcandoRuta && (
            <MarcarParadas
              paradas={modo.paradas}
              onCambio={(paradas) => setModo((m) => ({ ...m, paradas }))}
            />
          )}
          {enDibujo && (
            <DibujarPoligono onTerminar={(geometria) => setModo((m) => ({ ...m, geometria }))} />
          )}
          {modo?.tipo === 'zona-nueva' && modo.geometria && (
            <GeoJSON key="zona-borrador" data={modo.geometria} style={{ color: '#51318f', weight: 3 }} />
          )}
          {modo?.tipo === 'zona-editar' && (
            <EditarPoligono
              geometria={modo.geometria}
              color={zonas.find((z) => z.id === modo.id)?.color}
              onCambio={(geometria) => setModo((m) => ({ ...m, geometria }))}
            />
          )}
          <Encuadrar datos={barrios} />
          <IrA destino={destino} />
        </MapContainer>
      </div>
    </div>
  )
}

export default Mapa
