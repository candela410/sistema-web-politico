import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bootstrap va primero; bootstrap-tema.css deshace sus estilos base y le pone
// los colores de la campaña, y después index.css y cada pantalla lo pueden pisar
import 'bootstrap/dist/css/bootstrap.min.css'
import './bootstrap-tema.css'
import './index.css'
import './movimiento.css'
// Campos, botones e imágenes (equivalentes de TextInput, Pressable e Image)
import './interaccion.css'
// Modo oscuro: va al final para poder pisar los colores de todo lo anterior
import './tema-oscuro.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
