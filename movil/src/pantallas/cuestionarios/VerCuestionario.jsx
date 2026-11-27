import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Users } from 'lucide-react-native'
import * as api from '../../api/cuestionarios'
import { MARCA, useTema } from '../../tema/tema'
import { Acciones, Boton, Esqueleto, Etiqueta, Fila, Modal, Texto, TextoError, Text } from '../../ui'
import { tiene } from '../../util/permisos'

const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

// Ventana de solo lectura: datos del cuestionario, sus preguntas con las
// opciones y a qué equipos (y militantes) está asignado.
export default function VerCuestionario({ cuestionario, usuario, onCerrar }) {
  const { c } = useTema()
  const [detalle, setDetalle] = useState(null)
  const [asignados, setAsignados] = useState(null)
  const [error, setError] = useState('')
  const puedeVerAsignaciones = tiene(usuario, 'core.view_asignacioncuestionario')

  useEffect(() => {
    api
      .obtenerCuestionario(cuestionario.id)
      .then(setDetalle)
      .catch((e) => setError(e.message))
    if (puedeVerAsignaciones) {
      api
        .obtenerAsignaciones(cuestionario.id)
        .then((d) => {
          const soloAsignados = (usuarios) => usuarios.filter((u) => u.asignado)
          setAsignados({
            equipos: d.equipos.map((e) => ({ ...e, usuarios: soloAsignados(e.usuarios) })).filter((e) => e.usuarios.length > 0),
            sinEquipo: soloAsignados(d.sin_equipo),
            total: d.asignados,
          })
        })
        .catch((e) => setError(e.message))
    }
  }, [cuestionario.id, puedeVerAsignaciones])

  return (
    <Modal titulo="Detalle del cuestionario" onCerrar={onCerrar} ancho>
      <View style={{ gap: 6, marginBottom: 12 }}>
        <Text style={{ color: c.magentaTexto, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>{cuestionario.categoria.nombre}</Text>
        <Texto estilo="subtitulo">{cuestionario.titulo}</Texto>
        {cuestionario.descripcion ? <Texto estilo="suave">{cuestionario.descripcion}</Texto> : null}
        <Fila envolver gap={6}>
          <Etiqueta color={cuestionario.activo ? 'verde' : 'gris'}>{cuestionario.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
          <Etiqueta color="violeta">{plural(cuestionario.preguntas, 'pregunta', 'preguntas')}</Etiqueta>
          <Etiqueta color="magenta">{plural(cuestionario.encuestas, 'encuesta', 'encuestas')}</Etiqueta>
        </Fila>
        <Texto estilo="chico">Creado el {new Date(cuestionario.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</Texto>
      </View>
      <TextoError>{error}</TextoError>

      <Texto estilo="negrita" style={{ marginBottom: 6 }}>
        Preguntas
      </Texto>
      {detalle === null ? (
        !error && <Esqueleto filas={2} />
      ) : (
        detalle.preguntas.map((p, i) => (
          <View key={p.id} style={{ marginBottom: 10, padding: 10, backgroundColor: c.fondo, borderRadius: 10 }}>
            <Text style={{ color: c.texto, fontWeight: '700' }}>
              {i + 1}. {p.enunciado}
              {p.obligatoria ? <Text style={{ color: c.rojoTexto, fontSize: 12 }}>{'  '}Obligatoria</Text> : null}
            </Text>
            {p.opciones.map((o) => (
              <Texto key={o.id} estilo="suave" style={{ marginLeft: 12, marginTop: 2 }}>
                ○ {o.texto}
              </Texto>
            ))}
          </View>
        ))
      )}

      {puedeVerAsignaciones && (
        <View style={{ marginTop: 8 }}>
          <Fila style={{ marginBottom: 6 }}>
            <Texto estilo="negrita">Asignado a</Texto>
            {asignados && asignados.total > 0 && <Etiqueta color="violeta">{plural(asignados.total, 'usuario', 'usuarios')}</Etiqueta>}
          </Fila>
          {asignados === null ? (
            !error && <Esqueleto filas={1} />
          ) : asignados.total === 0 ? (
            <Texto estilo="suave">Todavía no está asignado a nadie.</Texto>
          ) : (
            [
              ...asignados.equipos.map((e) => ({ clave: e.id, nombre: e.nombre, inactivo: !e.activo, usuarios: e.usuarios })),
              ...(asignados.sinEquipo.length ? [{ clave: 'sin', nombre: 'Sin equipo', usuarios: asignados.sinEquipo }] : []),
            ].map((g) => (
              <View key={g.clave} style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 10, padding: 10, marginBottom: 8, gap: 6 }}>
                <Fila gap={6}>
                  <Users size={15} color={c.violetaTexto} />
                  <Texto estilo="negrita" style={{ flex: 1 }}>
                    {g.nombre}
                  </Texto>
                  {g.inactivo && <Etiqueta>Inactivo</Etiqueta>}
                  <Texto estilo="chico">{g.usuarios.length}</Texto>
                </Fila>
                <Fila envolver gap={8}>
                  {g.usuarios.map((u) => (
                    <Fila key={u.id} gap={6}>
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: MARCA.violeta, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>{u.nombre.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Texto estilo="suave">{u.nombre}</Texto>
                    </Fila>
                  ))}
                </Fila>
              </View>
            ))
          )}
        </View>
      )}
      <Acciones>
        <Boton titulo="Cerrar" onPress={onCerrar} />
      </Acciones>
    </Modal>
  )
}
