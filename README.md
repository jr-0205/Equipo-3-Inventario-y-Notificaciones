# Equipo 3 — Inventario y Notificaciones

Proyecto de microservicios con Node.js, Express, MySQL y Docker Compose.

## Componentes
- **Inventario** (`inventory`): API REST para consultar, crear, actualizar y eliminar productos.
- **Notificaciones** (`notifications`): API REST para registrar y consultar eventos/notificaciones.
- **MySQL 8.4**: persistencia de datos.
- **Frontend** (`frontend`): interfaz web sencilla para consultar inventario y notificaciones.

## Requisitos
- Docker Desktop instalado y en ejecución.
- Docker Compose v2 (`docker compose`).

## Iniciar el proyecto
Desde la raíz del repositorio:

```bash
docker compose up -d --build
docker compose ps
```

Abre la interfaz en http://localhost:8080.

## Puertos
- Frontend: `http://localhost:8080`
- Inventario API: `http://localhost:3001`
- Notificaciones API: `http://localhost:3002`
- MySQL desde el host: `127.0.0.1:3307`

## Endpoints principales
### Inventario (`http://localhost:3001`)
- `GET /health` — estado del servicio
- `GET /api/products` — listar productos
- `GET /api/products/:id` — consultar producto
- `POST /api/products` — crear producto (`name`, `description`, `quantity`, `price`)
- `PUT /api/products/:id` — actualizar producto
- `DELETE /api/products/:id` — eliminar producto

### Notificaciones (`http://localhost:3002`)
- `GET /health` — estado del servicio
- `GET /api/notifications` — listar notificaciones
- `POST /api/notifications` — registrar notificación (`service`, `message`, `type` opcional)

## Ejemplos con PowerShell
```powershell
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3001/api/products
Invoke-RestMethod http://localhost:3002/api/notifications
```

Crear un producto:
```powershell
$body = @{ name = 'Teclado'; description = 'Teclado USB'; quantity = 12; price = 249.99 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3001/api/products -ContentType 'application/json' -Body $body
```

Registrar una notificación:
```powershell
$body = @{ service = 'inventory'; message = 'Producto actualizado'; type = 'info' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3002/api/notifications -ContentType 'application/json' -Body $body
```

## Detener los servicios
```bash
docker compose down
```
Para eliminar también los datos de MySQL (acción destructiva): `docker compose down -v`.

## Configuración
Los valores de ejemplo están en `.env.example`. Docker Compose usa valores locales predeterminados para facilitar la práctica. Cambia las contraseñas antes de cualquier despliegue real.

> Estado: código y configuración preparados; realizar pruebas de ejecución e integración antes de considerar validado el proyecto.