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
