import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bootstrap va primero; bootstrap-tema.css deshace sus estilos base y le pone
// los colores de la campaña, y después index.css y cada pantalla lo pueden pisar
import 'bootstrap/dist/css/bootstrap.min.css'
import './bootstrap-tema.css'
import './index.css'
import './movimiento.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
