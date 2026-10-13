# Equipo 3 — Inventario y Notificaciones

Microservicios REST con Node.js, Express, MySQL y Docker Compose. Este repositorio contiene las API y la base de datos.

## Servicios y puertos publicados

- Inventario: `http://localhost:2506` (puerto interno del contenedor: 3001).
- Notificaciones: `http://localhost:2507` (puerto interno del contenedor: 3002).
- MySQL solo es accesible dentro de la red privada de Docker en `mysql:3306`; no se publica un puerto del host.

## Configurar e iniciar

Copia `.env.example` a `.env`, cambia ambas contraseñas y ejecuta desde la raíz. En Debian/Linux usa `cp .env.example .env && nano .env`; en PowerShell puedes usar `Copy-Item .env.example .env`. No reutilices las contraseñas de ejemplo en una red real. Mantén las credenciales de `.env` consistentes: cambiar `MYSQL_ROOT_PASSWORD` después de inicializar el volumen no cambia la contraseña de root guardada en MySQL.

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs --tail=100 mysql db-setup notifications inventory
curl -i http://localhost:2507/health
curl -i http://localhost:2506/health
```

`db-setup` debe terminar con código `0` y mostrar `Usuario y permisos de la aplicación verificados.`. Si la autenticación falla, el contenedor ahora también falla explícitamente en lugar de imprimir un éxito falso.

Para detener sin borrar datos: `docker compose down`. **Solo si quieres reiniciar MySQL desde cero y perder todos los datos**, ejecuta `docker compose down -v` y después `docker compose up --build -d`; esto elimina el volumen persistente de esta base de datos.

## Contrato de campos

Todos los campos de negocio se nombran en español:

- Inventario/producto: `id`, `nombre`, `descripcion`, `stock`, `precio`, `creado_en`, `actualizado_en`.
- Notificación: `id`, `servicio`, `mensaje`, `tipo`, `creado_en`.

Inventario es la fuente de verdad para las existencias; `stock` es la cantidad registrada.

Si algún servicio no aparece como `healthy`, revisa primero los logs de MySQL y confirma que el archivo `.env` existe y define `MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD`. Los puertos publicados para integrar con los demás equipos son Inventario `2506` y Notificaciones `2507`.

## API de Inventario

Base URL: `http://localhost:2506`

- `GET /health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products` — recibe `nombre`, `descripcion`, `stock`, `precio`.
- `PUT /api/products/:id` — actualiza esos campos.
- `DELETE /api/products/:id`

Prueba desde PowerShell:

```powershell
$body = @{ nombre = 'Teclado de prueba'; descripcion = 'Prueba de API'; stock = 10; precio = 250 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:2506/api/products -ContentType 'application/json' -Body $body
```

## API de Notificaciones

Base URL: `http://localhost:2507`

- `GET /health`
- `GET /api/notifications?limite=30`
- `POST /api/notifications` — recibe `servicio`, `mensaje`, `tipo`.
- `DELETE /api/notifications/:id`

Prueba desde PowerShell:

```powershell
$body = @{ servicio = 'pedidos'; mensaje = 'Compra procesada'; tipo = 'success' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:2507/api/notifications -ContentType 'application/json' -Body $body
```

## Red y seguridad

Usa la IPv4 LAN del equipo servidor desde las otras computadoras y permite los puertos TCP 2506 y 2507 en el firewall. MySQL no necesita exponerse a la red local.
