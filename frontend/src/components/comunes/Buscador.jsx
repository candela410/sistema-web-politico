import { X } from 'lucide-react'

// Buscador de los listados, con el botón "Limpiar" cuando hay texto escrito.
// Escape también lo vacía.
function Buscador({ valor, onCambio, placeholder, etiqueta }) {
  return (
    <div className="buscador">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        aria-label={etiqueta}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && valor && onCambio('')}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={100}
      />
      {valor && (
        <button type="button" className="buscador__limpiar" onClick={() => onCambio('')}>
          <X size={15} aria-hidden="true" />
          Limpiar
        </button>
      )}
    </div>
  )
}

export default Buscador
