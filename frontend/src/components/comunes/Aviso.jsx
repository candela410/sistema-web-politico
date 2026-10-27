// Mensaje a pantalla completa dentro del panel (sin campaña, sin permisos…)
function Aviso({ titulo, children }) {
  return (
    <main className="pagina">
      <div className="vacio-tarjeta">
        <b>{titulo}</b>
        <span>{children}</span>
      </div>
    </main>
  )
}

export default Aviso
