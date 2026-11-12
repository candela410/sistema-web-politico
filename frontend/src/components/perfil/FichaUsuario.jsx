import { CalendarDays, Clock, Flag, IdCard, Mail, MapPin, Phone, ShieldCheck, Users } from 'lucide-react'
import { inicialDe } from '../menu/usuario'
import './perfil.css'

// Ficha con los datos de un usuario. La usan "Mi perfil" y el botón "Ver" de
// Gestión → Usuarios. Recibe el usuario tal como lo manda el servidor (los dos
// formatos: el de la sesión y el de la lista de usuarios).
const formato = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short' })
const fecha = (iso) => (iso ? formato.format(new Date(iso)) : '')

function rolesDe(u) {
  if (u.es_superusuario) return 'Superusuario'
  const nombres = (u.grupos ?? []).map((g) => (typeof g === 'string' ? g : g.nombre))
  return nombres.join(', ') || 'Sin rol'
}

function Dato({ icono: Icono, etiqueta, valor }) {
  return (
    <div className="ficha__dato">
      <dt>
        <Icono size={16} aria-hidden="true" />
        {etiqueta}
      </dt>
      <dd>{valor || <span className="texto-suave">Sin cargar</span>}</dd>
    </div>
  )
}

function FichaUsuario({ usuario: u, campana }) {
  const nombre = `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || u.email
  return (
    <article className="ficha">
      <header className="ficha__encabezado">
        <span className="ficha__avatar" aria-hidden="true">
          {inicialDe(u)}
        </span>
        <div>
          <h2>{nombre}</h2>
          <span className="etiqueta etiqueta--magenta">{rolesDe(u)}</span>
          {u.activo === false && <span className="etiqueta">Desactivado</span>}
        </div>
      </header>
      <dl className="ficha__datos">
        <Dato icono={Mail} etiqueta="Correo electrónico" valor={u.email} />
        <Dato icono={IdCard} etiqueta="Documento" valor={u.documento} />
        <Dato icono={Phone} etiqueta="Teléfono" valor={u.telefono} />
        <Dato icono={MapPin} etiqueta="Dirección" valor={u.direccion} />
        {campana !== undefined && <Dato icono={Flag} etiqueta="Campaña" valor={campana} />}
        {u.equipo !== undefined && <Dato icono={Users} etiqueta="Equipo" valor={u.equipo} />}
        <Dato icono={ShieldCheck} etiqueta="Rol" valor={rolesDe(u)} />
        <Dato icono={Clock} etiqueta="Último ingreso" valor={u.ultimo_ingreso ? fecha(u.ultimo_ingreso) : 'Nunca ingresó'} />
        <Dato icono={CalendarDays} etiqueta="Usuario desde" valor={fecha(u.alta)} />
      </dl>
    </article>
  )
}

export default FichaUsuario
