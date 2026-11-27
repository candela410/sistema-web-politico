// Ficha con los datos de un usuario. La usan "Mi perfil" y el botón "Ver" de
// Gestión → Usuarios.
import { View } from 'react-native'
import { AtSign, CalendarDays, Clock, Flag, IdCard, Mail, MapPin, Phone, ShieldCheck, Users } from 'lucide-react-native'
import { useTema } from '../../tema/tema'
import { Avatar, Etiqueta, Fila, Texto } from '../../ui'
import { rolesDe } from '../../util/usuario'

const fecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

// Fila de dato con el diseño del desarrollo móvil: ícono en un cuadrado
// violeta claro, etiqueta chica y el valor debajo
function Dato({ icono: Icono, etiqueta, valor, ultimo }) {
  const { c } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: ultimo ? 0 : 1, borderColor: c.linea }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.superficie2, alignItems: 'center', justifyContent: 'center' }}>
        <Icono size={18} color={c.violetaTexto} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto estilo="chico">{etiqueta}</Texto>
        <Texto style={{ marginTop: 1, fontWeight: '700', color: valor ? c.texto : c.gris }}>{valor || 'Sin cargar'}</Texto>
      </View>
    </View>
  )
}

// sinCabecera: solo las filas de datos ("Mi perfil" muestra la foto y el nombre en su propia cabecera)
export default function FichaUsuario({ usuario: u, campana, sinCabecera }) {
  const nombre = `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || u.email
  return (
    <View>
      {!sinCabecera && (
        <Fila gap={14} style={{ marginBottom: 8 }}>
          <Avatar usuario={u} tamano={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Texto estilo="subtitulo">{nombre}</Texto>
            <Fila envolver gap={6}>
              <Etiqueta color="magenta">{rolesDe(u)}</Etiqueta>
              {u.activo === false && <Etiqueta>Desactivado</Etiqueta>}
            </Fila>
          </View>
        </Fila>
      )}
      <Dato icono={AtSign} etiqueta="Nombre de usuario" valor={u.username} />
      <Dato icono={Mail} etiqueta="Correo electrónico" valor={u.email} />
      <Dato icono={IdCard} etiqueta="Documento" valor={u.documento} />
      <Dato icono={Phone} etiqueta="Teléfono" valor={u.telefono} />
      <Dato icono={MapPin} etiqueta="Dirección" valor={u.direccion} />
      {campana !== undefined && <Dato icono={Flag} etiqueta="Campaña" valor={campana} />}
      {u.equipo !== undefined && <Dato icono={Users} etiqueta="Equipo" valor={u.equipo} />}
      <Dato icono={ShieldCheck} etiqueta="Rol" valor={rolesDe(u)} />
      <Dato icono={Clock} etiqueta="Último ingreso" valor={u.ultimo_ingreso ? fecha(u.ultimo_ingreso) : 'Nunca ingresó'} />
      <Dato icono={CalendarDays} etiqueta="Usuario desde" valor={fecha(u.alta)} ultimo />
    </View>
  )
}
