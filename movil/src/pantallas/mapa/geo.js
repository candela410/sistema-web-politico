// GeoJSON → coordenadas de react-native-maps ({ latitude, longitude }).
// En la web esto lo hacía Leaflet (L.geoJSON); acá se arma a mano.

const punto = ([lng, lat]) => ({ latitude: lat, longitude: lng })
const anillo = (coords) => coords.map(punto)

// Polígonos de una geometría (Polygon o MultiPolygon): [{ coordenadas, huecos }]
export function poligonosDe(geometria) {
  if (!geometria) return []
  if (geometria.type === 'Polygon') return [{ coordenadas: anillo(geometria.coordinates[0]), huecos: geometria.coordinates.slice(1).map(anillo) }]
  if (geometria.type === 'MultiPolygon')
    return geometria.coordinates.map((p) => ({ coordenadas: anillo(p[0]), huecos: p.slice(1).map(anillo) }))
  if (geometria.type === 'GeometryCollection') return geometria.geometries.flatMap(poligonosDe)
  return []
}

// Líneas (LineString o MultiLineString): [[{latitude, longitude}…]]
export function lineasDe(geometria) {
  if (!geometria) return []
  if (geometria.type === 'LineString') return [anillo(geometria.coordinates)]
  if (geometria.type === 'MultiLineString') return geometria.coordinates.map(anillo)
  if (geometria.type === 'GeometryCollection') return geometria.geometries.flatMap(lineasDe)
  if (geometria.type === 'Feature') return lineasDe(geometria.geometry)
  if (geometria.type === 'FeatureCollection') return geometria.features.flatMap((f) => lineasDe(f.geometry))
  return []
}

// Todas las coordenadas sueltas de cualquier GeoJSON (para encuadrar el mapa)
export function coordenadasDe(g) {
  if (!g) return []
  switch (g.type) {
    case 'FeatureCollection':
      return g.features.flatMap((f) => coordenadasDe(f.geometry))
    case 'Feature':
      return coordenadasDe(g.geometry)
    case 'GeometryCollection':
      return g.geometries.flatMap(coordenadasDe)
    case 'Point':
      return [punto(g.coordinates)]
    case 'MultiPoint':
    case 'LineString':
      return g.coordinates.map(punto)
    case 'MultiLineString':
    case 'Polygon':
      return g.coordinates.flat().map(punto)
    case 'MultiPolygon':
      return g.coordinates.flat(2).map(punto)
    default:
      return []
  }
}

export const paradasACoordenadas = (paradas) => paradas.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))

export const redondear = (n) => Math.round(n * 1e6) / 1e6

// Anillo de puntos [{latitude, longitude}] → Polygon GeoJSON (cerrado)
export function poligonoGeoJSON(puntos) {
  const anilloGeo = puntos.map((p) => [redondear(p.longitude), redondear(p.latitude)])
  anilloGeo.push([...anilloGeo[0]])
  return { type: 'Polygon', coordinates: [anilloGeo] }
}

// Vértices editables de una zona: [[poligono][anillo][vértice]] sin el punto de cierre repetido
export function verticesDe(geometria) {
  const polis = geometria?.type === 'Polygon' ? [geometria.coordinates] : geometria?.type === 'MultiPolygon' ? geometria.coordinates : []
  return polis.map((p) => p.map((r) => r.slice(0, -1)))
}

export function geometriaDesdeVertices(vertices) {
  const cerrar = (r) => [...r, [...r[0]]]
  const polis = vertices.map((p) => p.map(cerrar))
  return polis.length === 1 ? { type: 'Polygon', coordinates: polis[0] } : { type: 'MultiPolygon', coordinates: polis }
}
