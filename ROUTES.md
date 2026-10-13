# ROUTES — Equipo 3: Inventario y Notificaciones

## Bases
- Inventario: `INVENTARIO_URL`, puerto público 2506.
- Notificaciones: `NOTIFICACIONES_URL`, puerto público 2507.
- MySQL solo se utiliza dentro de Docker; no se expone como API HTTP.

## Inventario
| Método | Ruta | Función |
|---|---|---|
| GET | `/health` | Salud de DB |
| GET | `/api/products` | Catálogo enriquecido con existencias |
| GET | `/api/products/:id` | Producto/stock por ID |
| POST | `/api/products` | Registrar stock: `{ "productoId": 1, "stock": 10 }` |
| PUT | `/api/products/:id` | Actualizar stock |
| DELETE | `/api/products/:id` | Eliminar registro de stock (no el producto del catálogo) |

## Notificaciones
| Método | Ruta | Función |
|---|---|---|
| GET | `/health` | Salud |
| GET | `/api/notifications` | Listar notificaciones |
| GET | `/api/notifications/:id` | Consultar notificación, si está implementada |
| POST | `/api/notifications` | Registrar notificación |
| DELETE | `/api/notifications/:id` | Eliminar notificación, si está implementada |

## Contrato y reglas
- Campos normalizados: `id`, `nombre`, `descripcion`, `precio`, `stock`.
- El catálogo de Equipo 1 es fuente oficial de nombre/precio.
- Este servicio es la fuente oficial de existencias. Pedidos no debe confiar en el campo stock del catálogo.
- Las rutas de notificaciones se deben confirmar con el código actual antes de integrarlas con nuevos consumidores.
