// Mensaje para mostrar en la próxima pantalla (en la web iba en state de navigate)
let pendiente = ''
export const dejarAviso = (texto) => {
  pendiente = texto
}
export const tomarAviso = () => {
  const texto = pendiente
  pendiente = ''
  return texto
}
