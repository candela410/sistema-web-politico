# App móvil (React Native + Expo)

Versión para celular (Android e iOS) del panel de gestión. Reemplaza al frontend
web (React + Vite) y usa **el mismo backend Django**, sin cambios en la base.

## Requisitos

- Node.js 20 o más nuevo.
- En el celular, la app **Expo Go** (Play Store / App Store) para probar sin compilar.

## 1. Instalar

```powershell
cd movil
npm install
```

## 2. Dónde está el backend

En desarrollo no hace falta configurar nada: la app usa la IP de la compu que
corre Expo (la misma del QR) con el puerto 8000 de Django. Para otra dirección
(producción, u otra máquina) copiar `.env.example` a `.env` y completar:

```
EXPO_PUBLIC_API_URL=http://192.168.0.10:8000
```

No sirve `127.0.0.1`: para el celular eso es el propio celular.

## 3. Levantar Django para que lo vea el celular

```powershell
cd backend
.\venv\Scripts\python.exe manage.py runserver
```

Es el mismo backend de la web (carpeta `backend/` de este repositorio): no hay
otro backend para el celular.

Escucha en toda la red (`0.0.0.0:8000`) y, en modo desarrollo, acepta sola la IP
de la compu. Si no conecta, revisar que el celular y la compu estén en la misma red Wi-Fi y que el firewall de Windows deje pasar el puerto 8000.

## 4. Abrir la app

```powershell
npm start
```

Escanear el QR con Expo Go (Android) o con la cámara (iOS).

## Pruebas

```powershell
npm test
```

Dibuja cada pantalla con datos de ejemplo (sin servidor) y prueba algunas acciones.

## Cómo está armada

```
app-movil/
├── app/                   rutas (expo-router): las mismas direcciones que la web
│   ├── login, olvide, restablecer/[...partes], campana
│   └── (panel)/           todo lo que va con el menú lateral y la barra superior
│       ├── inicio, mapa, mi-ruta, equipos, categorias, dashboard
│       ├── cuestionarios/ (lista, nuevo, [id], [id]/estadisticas)
│       ├── responder/     (lista, [id])
│       ├── usuarios, grupos, permisos, actividad, tutorial
│       └── configuracion/ (mi perfil, backup)
├── src/
│   ├── api/               las mismas llamadas a Django que la web
│   ├── pantallas/         una carpeta por sección (igual que components/ en la web)
│   ├── ui/                piezas comunes: botones, campos, ventanas, listas, paginación…
│   ├── sesion/            usuario conectado y protección de cada pantalla por permiso
│   ├── tema/              colores, tipografías (Montserrat / Arimo) y modo oscuro
│   └── util/              validaciones, permisos, menú, PDF, almacenamiento
└── assets/                logo, fondo y videos de los tutoriales
```

### Qué cambió respecto de la web

| Web | App |
|---|---|
| React Router | expo-router (mismas rutas) |
| Bootstrap + CSS | estilos de React Native con los mismos colores |
| Cookies leídas con `document.cookie` | el backend devuelve el token CSRF en el JSON |
| Leaflet + Geoman | react-native-maps; las zonas se dibujan tocando el mapa |
| jsPDF | expo-print (HTML → PDF) y el menú Compartir del celular |
| `<input type="file">` para la foto | galería o cámara (expo-image-picker) |
| `<video>` | expo-video |
| localStorage | AsyncStorage |

### Para publicar en las tiendas

1. Poner la dirección pública del backend en `EXPO_PUBLIC_API_URL` (con HTTPS).
2. En Android, el mapa usa Google Maps: cargar una API key en `app.json`
   (`android.config.googleMaps.apiKey`). En Expo Go funciona sin key.
3. Compilar con EAS: `npx eas build -p android` / `npx eas build -p ios`.

### Enlaces de "restablecer contraseña"

El correo trae un enlace `FRONTEND_URL/restablecer/UID/TOKEN`. La app abre esa
pantalla si se toca un enlace `sistemapolitico://restablecer/UID/TOKEN`; además,
en "¿Olvidó su contraseña?" se puede **pegar el enlace** del correo y abrirlo.
