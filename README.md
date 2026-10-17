# Equipo 3 — Inventario y Notificaciones

Microservicios REST con **Node.js, Express, MySQL y Docker Compose**. Este repositorio contiene
las API, su base de datos y el servicio que registra los eventos del sistema. Cumple el
reglamento común (`../reglas.md`).

| Documento | Contenido |
|---|---|
| Este README | Cómo ejecutar, rutas, contrato y cómo conectar con los equipos 1 y 2 |
| `../reglas.md` | Reglas de integración de los tres equipos (puertos, red, firewall, checklist) |
| `postman/` | Colección Postman de los dos servicios |

## 1. Servicios y puertos

| Servicio | Puerto interno (contenedor) | Puerto publicado (host) | URL desde otra PC | Base de datos |
|---|---:|---:|---|---|
| **inventario** | 3005 | **2506** | `http://IP-EQUIPO-3:2506` | MySQL `team3_inventory` |
| **notificaciones** | 3006 | **2507** | `http://IP-EQUIPO-3:2507` | MySQL `team3_inventory` |
| mysql | 3306 | *no se publica* | — | volumen `mysql_data` |

- Dentro de esta computadora: `http://inventory:3005`, `http://notifications:3006`,
  `http://mysql:3306` (red Docker `equipo3-net`).
- Entre computadoras: IP de esta PC + puertos **2506** y **2507**. Nunca `localhost`
  ni el nombre del contenedor.
- MySQL **no** se expone a la red: para administrarlo, entra al contenedor
  (`docker compose exec mysql mysql -uroot -p`).
- El frontend del proyecto es **SuperPOS** (repositorio React aparte, puerto 2222); este
  repositorio solo expone las dos API.

## 2. Estructura

```text
Equipo-3-Inventario-y-Notificaciones/
|-- inventory/
|   |-- src/server.js
|   |-- Dockerfile
|   |-- package.json
|-- notifications/
|   |-- src/server.js
|   |-- Dockerfile
|   |-- package.json
|-- database/init.sql      # esquema + datos de ejemplo
|-- postman/
|-- docker-compose.yml
|-- .env.example
|-- README.md
```

## 3. Ejecutar

```powershell
git clone https://github.com/<usuario>/Equipo-3-Inventario-y-Notificaciones.git
cd Equipo-3-Inventario-y-Notificaciones
Copy-Item .env.example .env      # CAMBIA las dos contraseñas de MySQL
docker compose up --build -d
docker compose ps                # espera a que inventory y notifications estén "healthy"
```

El `docker-compose.yml` exige `MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD`: **sin `.env` no arranca**.

Comprobaciones rápidas:

```powershell
Invoke-RestMethod http://localhost:2506/health
Invoke-RestMethod http://localhost:2506/inventario
Invoke-RestMethod http://localhost:2507/health
Invoke-RestMethod http://localhost:2507/notificaciones
```

Los datos de ejemplo se crean solo la primera vez que se inicializa el volumen de MySQL.

## 4. Rutas de Inventario — base `http://IP-EQUIPO-3:2506`

| Método | Ruta canónica | Alias heredado (por compatibilidad) | Función |
|---|---|---|---|
| GET | `/` | — | Información, contrato y rutas |
| GET | `/health` | — | Estado del servicio y de MySQL |
| GET | `/inventario` | `/api/products` | Lista productos |
| GET | `/inventario/:productoId` | `/api/products/:id` | Consulta la existencia de un producto |
| POST | `/inventario` | `/api/products` | Crea un producto |
| PUT | `/inventario/:productoId` | `/api/products/:id` | Actualiza existencia y datos |
| DELETE | `/inventario/:productoId` | `/api/products/:id` | Elimina un producto |

Cuerpo de `POST`/`PUT` (el `PUT` también acepta solo los campos que cambian):

```json
{
  "nombre": "Teclado USB",
  "descripcion": "Teclado de oficina",
  "stock": 25,
  "precio": 249.99
}
```

- `nombre` es obligatorio; `descripcion`, `stock` y `precio` toman `0` / vacío si se omiten.
- Todas las altas, cambios y bajas generan una **notificación** enviada al puerto 2507.

## 5. Rutas de Notificaciones — base `http://IP-EQUIPO-3:2507`

| Método | Ruta canónica | Alias heredado | Función |
|---|---|---|---|
| GET | `/` | — | Información, contrato y rutas |
| GET | `/health` | — | Estado del servicio y de MySQL |
| GET | `/notificaciones?limite=30` | `/api/notifications?limit=30` | Lista los últimos eventos (1–200) |
| POST | `/notificaciones` | `/api/notifications` | Registra un evento |
| DELETE | `/notificaciones/:id` | `/api/notifications/:id` | Elimina un evento |

Cuerpo de `POST`:

```json
{ "servicio": "pedidos", "mensaje": "Compra procesada", "tipo": "success" }
```

`mensaje` es obligatorio. Se aceptan también los nombres heredados
`service`, `message` y `type`.

## 6. Contrato de datos

| Recurso | Campos oficiales (español) | Alias en inglés (compatibilidad) |
|---|---|---|
| Inventario | `id`, `nombre`, `descripcion`, `stock`, `precio`, `creado_en`, `actualizado_en` | `name`, `description`, `quantity`, `price`, `created_at`, `updated_at` |
| Notificaciones | `id`, `servicio`, `mensaje`, `tipo`, `creado_en` | `service`, `message`, `type`, `created_at` |

- El buscador de inventario usa `stock` como **fuente de verdad de las existencias**; el
  `stock` del catálogo de Productos (Equipo 1) es solo informativo.
- El **ID del producto debe coincidir** con el del catálogo del Equipo 1, porque Pedidos lo
  usa para verificar y descontar existencias.
- Las respuestas incluyen los dos vocabularios, así que sirven tanto al frontend SuperPOS
  (español) como a clientes antiguos (inglés). La base de datos conserva las columnas en
  inglés (`name`, `quantity`, ...) para no migrar volúmenes existentes.

### Códigos de respuesta

| Código | Cuándo |
|---|---|
| `200` / `201` | Operación correcta / registro creado |
| `400` | Falta `nombre` o `mensaje`, `stock` no es entero, `precio` negativo, `id` no numérico |
| `404` | Producto o notificación inexistente, o ruta desconocida (JSON) |
| `500` | Error de la base de datos |
| `503` | MySQL no disponible (`/health`) |

## 7. Integración con los equipos 1 y 2

- **Equipo 2 (Pedidos)** consume Inventario. En su `.env`:

  ```env
  INVENTARIO_URL=http://IP-EQUIPO-3:2506
  NOTIFICACIONES_URL=http://IP-EQUIPO-3:2507
  ```

  Pedidos consulta `GET /inventario/:productoId`, descuenta con
  `PUT /inventario/:productoId` y Pagos publica en `POST /notificaciones`.
- **SuperPOS (frontend)** usa `/api/products` y `/api/notifications` con campos en español;
  ambas rutas siguen disponibles como alias.
- **Este equipo no necesita configurar nada** para comunicarse con los otros: su
  `NOTIFICACIONES_URL` es interna (`http://notifications:3006`).

### Datos de contacto de este equipo (llenar y compartir)

| Dato | Valor |
|---|---|
| Integrantes | |
| IPv4 de la laptop (`ipconfig`) | |
| Hostname (`hostname`) | |
| Puertos publicados | 2506 (inventario), 2507 (notificaciones) |
| Firewall abierto | ☐ 2506 ☐ 2507 |

## 8. Firewall de Windows (en esta computadora)

```powershell
New-NetFirewallRule -DisplayName "Micro E3 Inventario 2506"     -Direction Inbound -Protocol TCP -LocalPort 2506 -Action Allow
New-NetFirewallRule -DisplayName "Micro E3 Notificaciones 2507" -Direction Inbound -Protocol TCP -LocalPort 2507 -Action Allow
Get-NetConnectionProfile     # el perfil de red debe ser Private, no Public
```

## 9. Comprobaciones obligatorias

Desde esta computadora:

```powershell
$body = @{ nombre = 'Teclado de prueba'; descripcion = 'Prueba de API'; stock = 10; precio = 250 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:2506/inventario -ContentType 'application/json' -Body $body

$body = @{ servicio = 'pedidos'; mensaje = 'Compra procesada'; tipo = 'success' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:2507/notificaciones -ContentType 'application/json' -Body $body

Invoke-RestMethod http://localhost:2507/notificaciones
```

Desde otra computadora:

```powershell
Test-Connection 192.168.1.103 -Count 2
Test-NetConnection 192.168.1.103 -Port 2506
Test-NetConnection 192.168.1.103 -Port 2507
Invoke-RestMethod http://192.168.1.103:2506/health
Invoke-RestMethod http://192.168.1.103:2507/health
```

Con Postman: importa `postman/Equipo-3-Inventario-Notificaciones.postman_collection.json` y
cambia la variable `host` por la IP de esta computadora.

## 10. Administración

```powershell
docker compose logs --tail=100 inventory notifications mysql
docker compose ps
docker compose down            # detener
docker compose down -v         # detener y BORRAR la base de datos (destructivo)
docker compose exec mysql mysql -uroot -p   # consola de MySQL
```

## 11. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker compose up` falla pidiendo una contraseña | No existe `.env` | `Copy-Item .env.example .env` y cambiar las contraseñas |
| `unhealthy` en `mysql` | Contraseña o volumen de otra versión | Revisar logs; `docker compose down -v` solo si se acepta borrar datos |
| Los datos de ejemplo no aparecen | El volumen ya existía | `init.sql` corre solo la primera vez; usa `down -v` si quieres reinicializar |
| `400 El campo 'stock' debe ser un entero...` | Se envió decimal o texto | Enviar el stock como entero (ej. `10`) |
| El otro equipo no conecta pero `ping` funciona | Firewall de Windows | Crear las reglas de la sección 8 |
| Al vender aparece “sin registro de inventario” | No existe el artículo con el mismo ID | Crear el artículo en Inventario con el ID del catálogo |
