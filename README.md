# Sistema web político

Proyecto con dos partes:

- `backend/`: Django 6.1 conectado a una base Postgres en Neon.
- `frontend/`: React + Vite.

## Backend

### 1. Crear el entorno e instalar dependencias (Windows / PowerShell)

```powershell
cd backend
py -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Configurar la base de datos

Copiar `backend/.env.example` a `backend/.env` y pegar en `DATABASE_URL` la cadena de
conexión de Neon (proyecto `noisy-haze-97297807`, rama `production`). Se obtiene en
https://console.neon.tech, botón **Connect**. Debe terminar en `?sslmode=require`.

El archivo `.env` está en `.gitignore` y nunca se sube al repositorio.

### 3. Probar la conexión a la base de datos

Con el entorno activado, dentro de `backend/`:

```powershell
python manage.py check --database default
python manage.py shell -c "from django.db import connection; c = connection.cursor(); c.execute('select version()'); print(c.fetchone()[0])"
```

Si todo está bien, el primer comando dice `System check identified no issues` y el
segundo imprime la versión de PostgreSQL de Neon. Ninguno de los dos crea tablas.

Los modelos están en `backend/core/models.py` (usuario propio `core.Usuario` con login por
email). Las tablas ya están creadas en Neon. Si se cambian los modelos:

```powershell
python manage.py makemigrations
python manage.py migrate
```

### 4. Levantar el servidor

```powershell
python manage.py runserver
```

### 5. Crear un usuario para entrar

```powershell
python manage.py createsuperuser   # pide email, username y contraseña
```

También se pueden crear usuarios desde el admin: http://127.0.0.1:8000/admin/

### 6. Tests

Corren sobre SQLite local, sin tocar Neon:

```powershell
$env:DATABASE_URL = "sqlite:///test.sqlite3"; python manage.py test core; Remove-Item Env:DATABASE_URL
```

## Frontend

```powershell
cd frontend
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # compilación de producción en frontend/dist
```

### Estructura del frontend

```
frontend/src/
├── App.jsx            rutas de navegación (React Router)
├── index.css          colores de la campaña y estilos compartidos (botones, formularios)
├── api/               llamadas a la API de Django
├── assets/            logo
└── components/        todas las vistas
    ├── login/         pantalla de ingreso
    ├── menu/          menú superior (logo, secciones, Salir)
    ├── mapa/          mapa de barrios, zonas y rutas
    ├── categorias/    ABM de categorías
    ├── cuestionarios/ lista y editor de cuestionarios
    └── comunes/       piezas reutilizables (ventana modal)
```

## Login

Usa las tablas de Django (`usuarios`, `django_session`, grupos y permisos) con sesiones y
CSRF, sin librerías extra. Con `runserver` y `npm run dev` levantados, entrar a
http://localhost:5173 con el email y la contraseña de un usuario.

El servidor de Vite reenvía `/api` a Django (`http://127.0.0.1:8000`), así el navegador
trata todo como el mismo sitio. Si Django corre en otro puerto:
`$env:API_PROXY_TARGET = "http://127.0.0.1:8001"` antes de `npm run dev`.

| Endpoint | Método | Qué hace |
|---|---|---|
| `/api/auth/csrf/` | GET | Deja la cookie `csrftoken` |
| `/api/auth/login/` | POST | `{"email", "password"}`, inicia la sesión |
| `/api/auth/me/` | GET | Usuario actual, o 401 si no hay sesión |
| `/api/auth/logout/` | POST | Cierra la sesión |

Los POST llevan el header `X-CSRFToken` con el valor de la cookie `csrftoken`.

## Mapa: barrios, calles, zonas y rutas

Después de iniciar sesión se abre el mapa (Leaflet + OpenStreetMap):

- **Barrios y calles** ya vienen cargados. Clic en un barrio para ver sus calles.
- **Zonas**: "+ Nueva zona", se dibuja el contorno en el mapa (Leaflet-Geoman) y los barrios
  cuyo centro queda adentro se asignan a la zona.
- **Rutas**: "+ Nueva ruta", se marcan los puntos en orden y OpenRouteService calcula el
  recorrido por las calles, con distancia y tiempo estimado.

Todo se guarda en GeoJSON (`geometria`) en la base.

### Cargar barrios y calles de una ciudad (OpenStreetMap)

```powershell
cd backend
python manage.py importar_osm "Córdoba, Córdoba, Argentina" --simular   # muestra qué cargaría
python manage.py importar_osm "Córdoba, Córdoba, Argentina"             # guarda
```

Se puede correr de nuevo: actualiza lo existente y no borra nada. Algunos barrios en
OpenStreetMap son solo un punto (sin contorno); se muestran como círculos.

### API key de OpenRouteService

Registrarse en https://openrouteservice.org/dev/#/signup, crear un token y agregarlo en
`backend/.env`:

```
ORS_API_KEY=el-token
```

| Endpoint | Métodos | Qué hace |
|---|---|---|
| `/api/mapa/barrios/` | GET | Barrios (GeoJSON) |
| `/api/mapa/calles/?barrio=ID` | GET | Calles de un barrio (GeoJSON) |
| `/api/mapa/zonas/` | GET, POST | Listar / crear zonas |
| `/api/mapa/zonas/ID/` | PATCH, DELETE | Editar / borrar una zona |
| `/api/mapa/rutas/` | GET, POST | Listar / crear rutas (calcula con OpenRouteService) |
| `/api/mapa/rutas/ID/` | PATCH, DELETE | Editar / borrar una ruta |

## Campañas, usuarios y permisos

- **Campañas:** el superusuario (o quien tenga el permiso "Puede elegir la campaña al
  ingresar") elige la campaña después de iniciar sesión. Todo lo que ve (rutas,
  cuestionarios, usuarios y actividad) es de esa campaña. Barrios, calles y zonas son
  territorio compartido por todas las campañas. El resto de los usuarios trabaja
  siempre en la campaña de su usuario.
- **Permisos:** se usan las tablas de Django: permisos (`auth_permission`), grupos
  (`auth_group`) y grupos por permisos (`auth_group_permissions`). Hay dos permisos propios:
  "Puede administrar la campaña" (incluye mapa, cuestionarios, categorías, usuarios, ver
  permisos y actividad) y "Puede elegir la campaña al ingresar". La migración `0005_grupos`
  crea el grupo "Militantes" (cargar encuestas). En la app se consultan en Gestión → Permisos.
- **Usuarios:** Gestión → Usuarios. Al crear un usuario se marca si administra la campaña y/o su grupo; los usuarios no se
  borran, se desactivan (así se conserva su historial).
- **Actividad:** cada alta, cambio, baja e inicio de sesión queda en el log de Django
  (`django_admin_log`) con el valor anterior y el nuevo de cada campo.

### Barrios sin contorno en OpenStreetMap

Algunos barrios figuran solo como un punto. El importador les estima un contorno (el área
más cercana a ese barrio que a los vecinos, hasta 450 m) y lo marca como aproximado; en el
mapa se dibuja con línea punteada. Para datos ya cargados:

```powershell
python manage.py aproximar_barrios
```

