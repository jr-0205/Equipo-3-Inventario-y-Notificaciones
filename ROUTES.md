# ROUTES — Equipo 3: Inventario y Notificaciones

## Bases
- Inventario: `INVENTARIO_URL`, puerto publicado **2506** (interno 3005).
- Notificaciones: `NOTIFICACIONES_URL`, puerto publicado **2507** (interno 3006).
- Catálogo del Equipo 1 (dependencia): `PRODUCTOS_URL`, puerto publicado **2502**.
- MySQL solo se utiliza dentro de Docker; no se expone como API HTTP.

## Responsabilidades
- Equipo 1 (Productos) es dueño de **IDs, nombres y precios**.
- Inventario es dueño de las **existencias** (`stock`).
- Los IDs que devuelve Inventario son los IDs del catálogo del Equipo 1: Pedidos usa el mismo
  ID para leer el precio y descontar existencias. **No** se emparejan productos por nombre.

## Inventario
| Método | Ruta canónica | Alias heredado | Función |
|---|---|---|---|
| GET | `/` | — | Información, contrato y rutas |
| GET | `/health` | — | Salud de MySQL y del catálogo (`catalogo.estado`) |
| GET | `/inventario` | `/api/products` | Catálogo del Equipo 1 con las existencias |
| GET | `/inventario/:productoId` | `/api/products/:id` | Existencia de un producto |
| POST | `/inventario` | `/api/products` | Registra existencias: `{ "productoId": 1, "stock": 10, "descripcion": "Estante A" }` |
| PUT | `/inventario/:productoId` | `/api/products/:id` | Actualiza solo la existencia: `{ "stock": 7 }` |
| DELETE | `/inventario/:productoId` | `/api/products/:id` | Elimina el registro de existencias (no el producto del catálogo) |

- El producto debe existir en el catálogo del Equipo 1; `POST` acepta `productoId` o el
  `nombre` exacto del catálogo. `nombre` y `precio` enviados por clientes se ignoran.
- Un producto del catálogo sin registro de existencias aparece con `stock: 0`.
- Si el catálogo no responde, Inventario responde `502` y no inventa datos.

## Notificaciones
| Método | Ruta canónica | Alias heredado | Función |
|---|---|---|---|
| GET | `/` | — | Información, contrato y rutas |
| GET | `/health` | — | Salud del servicio y de MySQL |
| GET | `/notificaciones?limite=30` | `/api/notifications?limit=30` | Listar las últimas notificaciones (1–200) |
| POST | `/notificaciones` | `/api/notifications` | Registrar notificación: `{ "servicio": "pedidos", "mensaje": "Compra procesada", "tipo": "success" }` |
| DELETE | `/notificaciones/:id` | `/api/notifications/:id` | Eliminar notificación |

Eventos registrados por el sistema: `inventario` (este equipo), `pagos` y `ventas` (Equipo 2).

## Contrato y reglas
- Campos normalizados: `id`, `productoId`, `nombre`, `descripcion`, `stock`, `precio`,
  `creado_en`, `actualizado_en`; notificación: `id`, `servicio`, `mensaje`, `tipo`, `creado_en`.
- `stock` es un entero ≥ 0. `precio` es un número ≥ 0 y proviene del catálogo del Equipo 1.
- Los campos de la base siguen en inglés (`name`, `quantity`, `price`) para no migrar datos.
- Errores: `400` datos inválidos, `404` producto o notificación inexistente, `502` catálogo no
  disponible, `503` MySQL no disponible, `500` error interno.

## Red
Permitir TCP 2506 y 2507 en el firewall del host. MySQL no se publica. Desde otra computadora
usar la IPv4/hostname del host, nunca `localhost` ni el nombre del contenedor.
