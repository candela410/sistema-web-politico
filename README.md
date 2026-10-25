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

Todavía no hay modelos ni migraciones, así que **no** hace falta correr `migrate`.

### 4. Levantar el servidor

```powershell
python manage.py runserver
```

## Frontend

```powershell
cd frontend
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173
npm run build    # compilación de producción en frontend/dist
```
