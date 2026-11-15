import { NavLink } from 'react-router'
import { DatabaseBackup, UserRound } from 'lucide-react'
import Backup from './Backup'
import MiPerfil from './MiPerfil'
import './configuracion.css'

// Configuración: "Mi perfil" (todos) y "Backup" (solo superusuarios).
// Cada pestaña tiene su dirección: /configuracion y /configuracion/backup.
function Configuracion({ usuario, onCambio, pestana = 'perfil' }) {
  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Configuración</h1>
          <p>{pestana === 'backup' ? 'Copias de seguridad de la base de datos.' : 'Sus datos en el sistema.'}</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      {usuario.es_superusuario && (
        <nav className="config-pestanas" aria-label="Secciones de configuración">
          <NavLink to="/configuracion" end className="config-pestanas__opcion">
            <UserRound size={18} aria-hidden="true" />
            Mi perfil
          </NavLink>
          <NavLink to="/configuracion/backup" className="config-pestanas__opcion">
            <DatabaseBackup size={18} aria-hidden="true" />
            Backup
          </NavLink>
        </nav>
      )}

      {pestana === 'backup' ? <Backup /> : <MiPerfil usuario={usuario} onCambio={onCambio} />}
    </main>
  )
}

export default Configuracion
