import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Check, Minus, X } from 'lucide-react-native'
import { obtenerPermisos } from '../../api/usuarios'
import { MARCA, useTema } from '../../tema/tema'
import { Boton, Encabezado, Etiqueta, Fila, Pagina, Paginacion, Selector, Tarjeta, Texto, TextoError, VacioTarjeta, usePaginado, Text } from '../../ui'

// Permisos de Django por rol, solo para consultar. Se cambian en Gestión → Roles.
const ACCIONES = [
  { clave: 'Ver', texto: 'Ver' },
  { clave: 'Crear', texto: 'Crear' },
  { clave: 'Editar', texto: 'Editar' },
  { clave: 'Borrar', texto: 'Eliminar' },
]

export default function Permisos() {
  const { c } = useTema()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [elegido, setElegido] = useState(null)

  const cargar = () =>
    obtenerPermisos()
      .then((d) => {
        setDatos(d)
        setElegido((e) => e ?? d.grupos[0]?.id ?? null)
      })
      .catch((e) => setError(e.message))
  useEffect(() => {
    cargar()
  }, [])

  const paginado = usePaginado(datos?.usuarios ?? [])

  if (error)
    return (
      <Pagina>
        <TextoError>{error}</TextoError>
      </Pagina>
    )
  if (!datos)
    return (
      <Pagina>
        <VacioTarjeta>Cargando…</VacioTarjeta>
      </Pagina>
    )

  const rol = datos.grupos.find((g) => g.id === elegido)
  const porDefecto = datos.grupos[0]?.id ?? null
  const celda = { width: 64, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado titulo="Permisos" descripcion="Qué puede hacer cada rol en cada sección del sistema." />

      {datos.grupos.length === 0 ? (
        <VacioTarjeta>Todavía no hay roles.</VacioTarjeta>
      ) : (
        <>
          <Fila style={{ alignItems: 'flex-end' }}>
            <Selector
              etiqueta="Rol"
              style={{ flex: 1, marginBottom: 0 }}
              valor={elegido ?? ''}
              onCambio={(v) => setElegido(Number(v))}
              opciones={datos.grupos.map((g) => ({ valor: g.id, texto: `${g.nombre} (${g.usuarios} usuario${g.usuarios === 1 ? '' : 's'})` }))}
            />
            <Boton titulo="Limpiar" icono={X} variante="borde" onPress={() => setElegido(porDefecto)} disabled={elegido === porDefecto} />
          </Fila>

          {rol && rol.permisos.length === 0 ? (
            <VacioTarjeta>El rol {rol.nombre} no tiene permisos asignados.</VacioTarjeta>
          ) : (
            rol && (
              <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
                <ScrollView horizontal>
                  <View>
                    <View style={{ flexDirection: 'row', backgroundColor: c.superficie2 }}>
                      <Text style={{ width: 170, padding: 10, color: c.texto, fontWeight: '800' }}>Sección</Text>
                      {ACCIONES.map((a) => (
                        <View key={a.clave} style={celda}>
                          <Text style={{ color: c.texto, fontWeight: '800', fontSize: 13 }}>{a.texto}</Text>
                        </View>
                      ))}
                    </View>
                    {rol.permisos.map((s, i) => (
                      <View key={s.seccion} style={{ flexDirection: 'row', borderTopWidth: i ? 1 : 0, borderColor: c.linea }}>
                        <Text style={{ width: 170, padding: 10, color: c.texto, fontWeight: '600' }}>{s.seccion}</Text>
                        {ACCIONES.map((a) => (
                          <View key={a.clave} style={celda} accessibilityLabel={`${a.texto}: ${s.acciones.includes(a.clave) ? 'Sí' : 'No'}`}>
                            {s.acciones.includes(a.clave) ? <Check size={18} color={MARCA.verde} /> : <Minus size={16} color={c.borde} />}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </Tarjeta>
            )
          )}
        </>
      )}

      <Texto estilo="subtitulo" style={{ marginTop: 8 }}>
        Usuarios de la campaña
      </Texto>
      {datos.usuarios.length === 0 ? (
        <VacioTarjeta>No hay usuarios activos en esta campaña.</VacioTarjeta>
      ) : (
        <>
          {paginado.items.map((u) => (
            <Tarjeta key={u.id} style={{ gap: 4, padding: 12 }}>
              <Texto estilo="negrita">{u.nombre}</Texto>
              <Texto estilo="chico">{u.email}</Texto>
              <Fila envolver gap={6}>
                {u.superusuario && <Etiqueta color="violeta">Superusuario</Etiqueta>}
                {u.grupos.map((g) => (
                  <Etiqueta key={g} color="magenta">
                    {g}
                  </Etiqueta>
                ))}
                {!u.superusuario && !u.grupos.length && <Etiqueta>Sin rol</Etiqueta>}
              </Fila>
            </Tarjeta>
          ))}
          <Paginacion {...paginado} />
        </>
      )}
    </Pagina>
  )
}
