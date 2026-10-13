# Equipo 3 — Inventario y Notificaciones

Microservicios REST con Node.js, Express, MySQL y Docker Compose. Inventario administra cantidades; el catálogo comercial y los precios oficiales pertenecen al Equipo 1.

## Servicios y puertos publicados

- Inventario: `http://localhost:2506` (puerto interno 3001).
- Notificaciones: `http://localhost:2507` (puerto interno 3002).
- Productos del Equipo 1: `http://localhost:2502`.
- MySQL solo es accesible dentro de la red privada Docker en `mysql:3306`; no se publica un puerto del host.

## Configurar e iniciar

Copia `.env.example` a `.env`, cambia ambas contraseñas y comprueba que Productos del Equipo 1 esté disponible en el puerto 2502. En Debian/Linux:

```bash
cp .env.example .env
nano .env
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs --tail=100 mysql db-setup notifications inventory
curl -i http://localhost:2507/health
curl -i http://localhost:2506/health
curl -i http://localhost:2506/api/products
```

En `.env`, configura `PRODUCTOS_URL=http://host.docker.internal:2502` si el Equipo 1 corre en el mismo host Docker. Si está en otra computadora, usa su IPv4, por ejemplo `PRODUCTOS_URL=http://192.168.1.51:2502`. La dirección debe ser alcanzable desde el contenedor de Inventario.

`db-setup` debe terminar con código 0. No ejecutes `docker compose down -v` salvo que aceptes borrar todos los datos persistentes de MySQL.

## Responsabilidades y sincronización

- **Equipo 1 — Productos** es la fuente oficial de los IDs, nombres y precios.
- **Equipo 3 — Inventario** es la fuente oficial de las cantidades disponibles (`stock`).
- Inventario consulta `PRODUCTOS_URL/products` (API real: `/productos`) para construir la lista visible. Los precios no se editan ni se guardan como dato oficial en Inventario.
- Los IDs devueltos por `/api/products` son los IDs del catálogo del Equipo 1, de modo que Pedidos pueda usar el mismo ID para consultar el precio y descontar existencias.
- Para registrar una cantidad, el producto primero debe existir en Productos. `POST /api/products` acepta `productoId` o el nombre existente del catálogo, además de `stock`. No crea productos comerciales.
- `PUT /api/products/:id` modifica únicamente `stock`; los campos `nombre` y `precio` enviados por clientes antiguos se ignoran.
- El borrado de `DELETE /api/products/:id` elimina el registro de existencias, no el producto comercial del Equipo 1.

Los registros históricos de MySQL cuyo nombre no exista en el catálogo actual no se muestran en la lista de Inventario. No se borran automáticamente de la base de datos.

## API de Inventario

Base URL: `http://localhost:2506`

- `GET /health`
- `GET /api/products` — catálogo de Equipo 1 con cantidades de Inventario.
- `GET /api/products/:id`
- `POST /api/products` — registra existencias para un producto ya existente.
- `PUT /api/products/:id` — actualiza solo la cantidad.
- `DELETE /api/products/:id` — elimina solo el registro de existencias.

Ejemplo PowerShell:

```powershell
$body = @{ productoId = 1; stock = 10 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:2506/api/products -ContentType 'application/json' -Body $body
```

## API de Notificaciones

Base URL: `http://localhost:2507`

- `GET /health`
- `GET /api/notifications?limite=30`
- `POST /api/notifications` — recibe `servicio`, `mensaje`, `tipo`.
- `DELETE /api/notifications/:id`

## Red y seguridad

Usa la IPv4 LAN del equipo servidor desde otras computadoras y permite los puertos TCP 2506 y 2507 en el firewall. MySQL no necesita exponerse a la red local.
