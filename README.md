# Equipo 3 — Inventario y Notificaciones

Proyecto académico de microservicios con Node.js, Express, MySQL y Docker Compose.

## Componentes y puertos
- **MySQL 8.4:** `localhost:20001` desde el equipo anfitrión (dentro de Docker usa `mysql:3306`).
- **Inventario REST:** `http://localhost:20002` (dentro de Docker escucha en `3001`).
- **Notificaciones REST:** `http://localhost:20003` (dentro de Docker escucha en `3002`).
- **Frontend Nginx:** `http://localhost:20004` (dentro del contenedor usa el puerto `80`).

## Requisitos
- Docker Desktop instalado y en ejecución.
- Docker Compose v2.

## Iniciar
Desde la raíz del repositorio:
```powershell
git pull --ff-only
docker compose up --build -d
docker compose ps
```
Abre `http://localhost:20004`.

### Integración con las API del Equipo 1
- Clientes: `http://IP-DEL-EQUIPO-1:3001/clientes` y `http://IP-DEL-EQUIPO-1:3001/clientes/:id`.
- Productos: `http://IP-DEL-EQUIPO-1:3002/productos` y `http://IP-DEL-EQUIPO-1:3002/productos/:id`.
- Campus Core debe apuntar directamente a los puertos `3001` y `3002` y usar las rutas `/clientes` y `/productos`. No usar `/gateway/clientes` ni `/gateway/productos` para las API directas descritas por el Equipo 1.
- En la sección Conexiones, configura la IP real del equipo que aloja esos servicios. Comprueba primero las rutas desde el navegador o con `Invoke-RestMethod`.

### Acceso desde otra computadora de la red
- Abre Campus Core usando la IP LAN del equipo donde corre Docker, por ejemplo `http://192.168.1.234:20004` (usa la IP real de ese equipo).
- El frontend integrado calcula automáticamente las direcciones de Inventario (`:20002`) y Notificaciones (`:20003`) a partir del hostname con el que se abrió la página.
- Si el navegador ya tenía direcciones antiguas guardadas, el frontend migra `localhost`/`127.0.0.1` para esos dos servicios; conserva las direcciones personalizadas de los gateways de los otros equipos.
- Si no conecta, permite los puertos `20002`, `20003` y `20004` en el firewall del equipo servidor y verifica `docker compose ps`.

## Pruebas de salud
```powershell
Invoke-RestMethod http://localhost:20002/health
Invoke-RestMethod http://localhost:20003/health
Invoke-RestMethod http://localhost:20002/api/products
Invoke-RestMethod http://localhost:20003/api/notifications
```

## Endpoints de inventario
Base URL: `http://localhost:20002`
- `GET /health` — estado del servicio y conexión a MySQL.
- `GET /api/products` — listar productos.
- `GET /api/products/:id` — consultar un producto.
- `POST /api/products` — crear producto (`name`, `description`, `quantity`, `price`).
- `PUT /api/products/:id` — actualizar producto.
- `DELETE /api/products/:id` — eliminar producto.

Ejemplo de creación desde PowerShell:
```powershell
$body = @{ name = 'Teclado de prueba'; description = 'Registrado desde PowerShell'; quantity = 10; price = 250 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:20002/api/products -ContentType 'application/json' -Body $body
```

## Endpoints de notificaciones
Base URL: `http://localhost:20003`
- `GET /health` — estado del servicio y conexión a MySQL.
- `GET /api/notifications` — listar notificaciones (`?limit=30` opcional).
- `POST /api/notifications` — crear notificación (`service`, `message`, `type` opcional).
- `DELETE /api/notifications/:id` — eliminar una notificación.

Ejemplo:
```powershell
$body = @{ service = 'manual'; message = 'Prueba de notificación'; type = 'info' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:20003/api/notifications -ContentType 'application/json' -Body $body
```

## Registros y apagado
```powershell
docker compose logs --tail=100 inventory notifications frontend mysql
docker compose down
```
`docker compose down -v` elimina también el volumen de MySQL y los datos guardados; úsalo solo si deseas borrar la base de datos.

## Notas
- El frontend llama a los puertos del host `20002` y `20003`; por ello está pensado para abrirse en el mismo equipo que ejecuta Docker.
- La comunicación entre microservicios dentro de Docker usa `http://notifications:3002`.
- Si ya existía el volumen `mysql_data`, MySQL conserva los datos previos; el script de inicialización solo se ejecuta al crear una base de datos inicializada nueva.
- Antes de desplegar en un entorno real, cambia las contraseñas de ejemplo del archivo `.env`/`.env.example`.