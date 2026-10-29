// Fondo del login: olas de colores y foto difuminada del lado izquierdo.
// Lo usan Login y Restablecer (elegir contraseña nueva).
// Foto del lado izquierdo (guardala en src/assets/fondo.png)
import fondo from '../../assets/fondo.png'

export default function FondoLogin() {
  return (
    <>
      {/* OLA SUPERIOR violeta (solo decoración) */}
      <svg
        className="login__wave-top"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 0 H1440 V70 C1180 150 900 20 620 80 C380 130 180 110 0 60 Z"
          fill="#533693"
        />
      </svg>

      {/* OLAS INFERIORES de colores: naranja (atrás), rosa (medio) y violeta (adelante) */}
      <svg
        className="login__wave-bottom"
        viewBox="0 0 1440 260"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 120 C300 40 700 220 1000 120 C1200 55 1340 70 1440 30 V260 H0 Z"
          fill="#fdb03e"
        />
        <path
          d="M0 170 C260 110 620 250 960 175 C1190 125 1330 150 1440 110 V260 H0 Z"
          fill="#d8267e"
        />
        <path
          d="M0 215 C300 170 640 270 980 220 C1200 190 1340 205 1440 180 V260 H0 Z"
          fill="#533693"
        />
      </svg>

      {/* LADO IZQUIERDO: foto difuminada que se funde con el blanco hacia la derecha */}
      <div className="login__photo" aria-hidden="true">
        <img src={fondo} alt="" />
      </div>
    </>
  )
}
