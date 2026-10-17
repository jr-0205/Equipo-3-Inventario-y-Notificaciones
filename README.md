# Equipo 3 — Inventario y Notificaciones

Microservicios REST con **Node.js, Express, MySQL y Docker Compose**. Este repositorio expone
las existencias (stock) y el registro de notificaciones del sistema.

| Documento | Contenido |
|---|---|
| Este README | Cómo ejecutar, rutas, contrato y cómo conectar con los equipos 1 y 2 |
| `../reglas.md` | Acuerdo de integración de los tres equipos (puertos, red, firewall, checklist) |
| `ROUTES.md` | Rutas y contratos de este equipo (documento compartido con los otros equipos) |
| `MICROSERVICES_STANDARD.md` | Estándar general de microservicios SuperPOS (acuerdo de los tres equipos) |
| `.env.example` | Plantilla de configuración común: hosts y puertos de los tres equipos |
| `postman/` | Colección Postman de los dos servicios |

## 1. Servicios y puertos

| Servicio | Puerto interno (contenedor) | Puerto publicado (host) | URL desde otra PC | Datos |
|---|---:|---:|---|---|
| **inventario** | 3005 | **2506** | `http://IP-EQUIPO-3:2506` | MySQL `team3_inventory` |
| **notificaciones** | 3006 | **2507** | `http://IP-EQUIPO-3:2507` | MySQL `team3_inventory` |
| mysql | 3306 | *no se publica* | — | volumen `mysql_data` |
| catálogo del Equipo 1 | — | **2502** | `http://IP-EQUIPO-1:2502` | lo consume Inventario |

- Dentro de esta computadora: `http://inventory:3005`, `http://notifications:3006` y
  `http://mysql:3306` (red Docker `equipo3-net`).
- Entre computadoras: IP de esta PC + puertos **2506** y **2507**. Nunca `localhost` ni el
  nombre del contenedor.
- MySQL **no** se expone a la red; se administra con `docker compose exec mysql mysql -uroot -p`.
- El frontend del proyecto es **SuperPOS** (repositorio React aparte, puerto 2222).

## 2. Responsabilidades (quién es dueño de qué)

- **Equipo 1 — Productos** es la fuente oficial de **IDs, nombres y precios**.
- **Equipo 3 — Inventario** es la fuente oficial de las **existencias** (`stock`).
- Inventario consulta el catálogo en `PRODUCTOS_URL + /productos` para construir la lista
  visible; **no** guarda precios como dato oficial (solo una copia de apoyo).
- Los IDs que devuelve Inventario son los **IDs del catálogo del Equipo 1**, de modo que
  Pedidos usa el mismo ID para consultar el precio y descontar existencias.
- Para registrar una cantidad, el producto **primero debe existir** en el catálogo del
  Equipo 1: `POST` acepta `productoId` (recomendado) o el `nombre` exacto del catálogo.
  Inventario no crea productos comerciales.
- `PUT` modifica **únicamente** `stock`; los campos `nombre` o `precio` que envíe un cliente
  antiguo se ignoran (los define el catálogo).
- `DELETE` elimina el **registro de existencias**, no el producto del catálogo.

## 3. Ejecutar

```powershell
git clone https://github.com/<usuario>/Equipo-3-Inventario-y-Notificaciones.git
cd Equipo-3-Inventario-y-Notificaciones
Copy-Item .env.example .env      # CAMBIA las dos contraseñas de MySQL
# Revisa PRODUCTOS_URL: debe apuntar al Equipo 1 (http://IP-EQUIPO-1:2502)
docker compose config --quiet
docker compose up --build -d
docker compose ps -a             # espera mysql "healthy" y db-setup con código 0
```

`db-setup` verifica el usuario y los permisos de MySQL y debe terminar con **código 0**; los
dos servicios esperan a que concluya. El `docker-compose.yml` **exige**
`MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD`: sin `.env` no arranca.

Comprobaciones rápidas:

```powershell
Invoke-RestMethod http://localhost:2506/health
Invoke-RestMethod http://localhost:2506/inventario
Invoke-RestMethod http://localhost:2507/health
Invoke-RestMethod http://localhost:2507/notificaciones
```

`init.sql` solo se ejecuta la **primera vez** que se crea el volumen de MySQL.

## 4. Rutas de Inventario — base `http://IP-EQUIPO-3:2506`

| Método | Ruta canónica | Alias heredado | Función |
|---|---|---|---|
| GET | `/` | — | Información, contrato y rutas |
| GET | `/health` | — | Estado del servicio, de MySQL y del catálogo |
| GET | `/inventario` | `/api/products` | Catálogo del Equipo 1 con las existencias |
| GET | `/inventario/:productoId` | `/api/products/:id` | Existencia de un producto |
| POST | `/inventario` | `/api/products` | Registra existencias de un producto existente |
| PUT | `/inventario/:productoId` | `/api/products/:id` | Actualiza **solo** la existencia |
| DELETE | `/inventario/:productoId` | `/api/products/:id` | Elimina el registro de existencias |

Cuerpo de `POST` (el `nombre` o el `productoId` deben existir en el catálogo del Equipo 1):

```json
{ "productoId": 1, "stock": 10, "descripcion": "Estante A" }
```

Cuerpo de `PUT`: `{ "stock": 7 }`.

Respuesta de un producto:

```json
{
  "id": 1, "productoId": 1, "nombre": "Laptop Dell", "descripcion": "Estante A",
  "stock": 10, "precio": 12999.00,
  "creado_en": "2026-01-01T10:00:00.000Z", "actualizado_en": "2026-01-01T12:00:00.000Z"
}
```

- `nombre` y `precio` provienen del catálogo del Equipo 1; `stock` es la existencia real.
- Un producto del catálogo sin registro de existencias aparece con `stock: 0`.
- Si el catálogo del Equipo 1 no responde, Inventario responde **502** (no inventa datos) y
  `/health` lo indica en `catalogo.estado`.

## 5. Rutas de Notificaciones — base `http://IP-EQUIPO-3:2507`

| Método | Ruta canónica | Alias heredado | Función |
|---|---|---|---|
| GET | `/` | — | Información, contrato y rutas |
| GET | `/health` | — | Estado del servicio y de MySQL |
| GET | `/notificaciones?limite=30` | `/api/notifications?limit=30` | Últimos eventos (1–200) |
| POST | `/notificaciones` | `/api/notifications` | Registra un evento |
| DELETE | `/notificaciones/:id` | `/api/notifications/:id` | Elimina un evento |

Cuerpo de `POST` (se aceptan también `service`, `message` y `type`):

```json
{ "servicio": "pedidos", "mensaje": "Compra procesada", "tipo": "success" }
```

Eventos que genera el sistema:

| `servicio` | Quién lo envía | Cuándo |
|---|---|---|
| `inventario` | Inventario (este equipo) | Al registrar, actualizar o eliminar existencias |
| `pagos` | Pagos (Equipo 2) | Al aprobar un pago |
| `ventas` | Pedidos (Equipo 2) | Al completar la venta |

## 6. Contrato de datos

| Recurso | Campos oficiales |
|---|---|
| Existencia de inventario | `id`, `productoId`, `nombre`, `descripcion`, `stock`, `precio`, `creado_en`, `actualizado_en` |
| Notificación | `id`, `servicio`, `mensaje`, `tipo`, `creado_en` |

- El **ID es el del catálogo del Equipo 1**; no se emparejan productos por nombre.
- `stock` es un **entero ≥ 0**; `precio` es un número ≥ 0 y la base conserva las columnas en
  inglés (`name`, `quantity`, `price`) para no migrar volúmenes existentes.

### Códigos de respuesta

| Código | Cuándo |
|---|---|
| `200` / `201` | Operación correcta / existencias registradas |
| `400` | Falta `stock`, no es entero, `id` no numérico o JSON inválido |
| `404` | Producto inexistente en el catálogo, sin registro de existencias, o ruta desconocida (JSON) |
| `500` | Error de la base de datos |
| `502` | El catálogo del Equipo 1 no está disponible |
| `503` | MySQL no disponible (`/health`) |

## 7. Integración con los equipos 1 y 2

- **Equipo 1 (Productos)** — Inventario lo consulta; en su `.env`:

  ```env
  PRODUCTOS_URL=http://IP-EQUIPO-1:2502
  ```

  Si el catálogo corre en la **misma** computadora que Inventario y está publicado en el
  host, puede dejarse vacío: el servicio usa `http://host.docker.internal:2502`.
- **Equipo 2 (Pedidos y Pagos)** consume Inventario y Notificaciones; en su `.env`:

  ```env
  INVENTARIO_URL=http://IP-EQUIPO-3:2506
  NOTIFICACIONES_URL=http://IP-EQUIPO-3:2507
  ```

- Este equipo no necesita configurar nada hacia el Equipo 2: sus notificaciones internas usan
  `http://notifications:3006`.

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
$body = @{ productoId = 1; stock = 10 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:2506/inventario -ContentType 'application/json' -Body $body

$body = @{ stock = 7 } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri http://localhost:2506/inventario/1 -ContentType 'application/json' -Body $body

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
docker compose logs --tail=100 mysql db-setup notifications inventory
docker compose ps -a
docker compose down            # detener
docker compose down -v         # detener y BORRAR la base de datos (destructivo)
docker compose exec mysql mysql -uroot -p   # consola de MySQL
```

## 11. Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker compose up` falla pidiendo una contraseña | No existe `.env` | `Copy-Item .env.example .env` y cambiar las contraseñas |
| `db-setup` termina con código distinto de 0 | Contraseña o usuario mal configurados | Revisar `docker compose logs db-setup`; recrear con `docker compose up -d --force-recreate db-setup` |
| `502` al listar inventario | El catálogo del Equipo 1 no responde | Revisar `PRODUCTOS_URL` y `GET /health` de Productos |
| `404 Primero crea el producto...` al registrar existencia | El producto no existe en el catálogo del Equipo 1 | Crear el producto con el Equipo 1 y usar el mismo `productoId` |
| Los datos de ejemplo no aparecen | El volumen ya existía | `init.sql` corre solo la primera vez; `docker compose down -v` lo reinicializa |
| Al vender aparece "sin registro de inventario" | No hay registro de existencias para ese ID | Registrar existencias con `POST /inventario` usando el `productoId` del catálogo |
| El otro equipo no conecta pero `ping` funciona | Firewall de Windows | Crear las reglas de la sección 8 |
