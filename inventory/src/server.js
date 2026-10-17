const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3005);

/*
 * Catalogo oficial (Equipo 1): es la fuente de los IDs, nombres y precios.
 * Por defecto se asume que el catalogo corre en esta misma computadora; cuando vive
 * en otra PC se configura PRODUCTOS_URL en el archivo .env.
 */
const PRODUCTOS_URL = String(process.env.PRODUCTOS_URL || 'http://host.docker.internal:2502')
  .trim()
  .replace(/\/+$/, '');
const CATALOGO_TIMEOUT_MS = Number(process.env.CATALOGO_TIMEOUT_MS || process.env.REQUEST_TIMEOUT_MS || 5000);
const CATALOGO_HEALTH_TIMEOUT_MS = Math.min(CATALOGO_TIMEOUT_MS, 1500);

/*
 * Notificaciones (mismo equipo). El nombre oficial de la variable es en espanol
 * (NOTIFICACIONES_URL, igual que el Equipo 2 y el estandar); se acepta el heredado
 * en ingles para no romper configuraciones anteriores.
 */
const NOTIFICACIONES_URL = String(process.env.NOTIFICACIONES_URL || process.env.NOTIFICATIONS_URL || '')
  .trim()
  .replace(/\/+$/, '');
const NOTIFICACIONES_PATHS = ['/notificaciones', '/api/notifications'];

/*
 * Inventario guarda UNICAMENTE las existencias. El nombre y el precio se leen del
 * catalogo del Equipo 1 y la llave de la tabla es el id de ese catalogo, de modo que
 * Pedidos puede usar el mismo ID para consultar el precio y descontar existencias.
 */
const CAMPOS_EXISTENCIA = `
  id,
  name AS nombre,
  description AS descripcion,
  quantity AS stock,
  price AS precio,
  created_at AS creado_en,
  updated_at AS actualizado_en
`;

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'team3_app',
  password: process.env.DB_PASSWORD || 'team3pass123',
  database: process.env.DB_NAME || 'team3_inventory',
  waitForConnections: true,
  connectionLimit: 10
});

function primerDefinido(...valores) {
  for (const valor of valores) {
    if (valor !== undefined && valor !== null && valor !== '') return valor;
  }
  return null;
}

function parsearId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function numeroONull(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

/* ------------------------------------------------------------------ */
/* Catalogo del Equipo 1                                               */
/* ------------------------------------------------------------------ */

async function catalogo(timeoutMs = CATALOGO_TIMEOUT_MS) {
  let response;

  try {
    response = await fetch(`${PRODUCTOS_URL}/productos`, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw errorHttp(502, `No se pudo consultar el catalogo del Equipo 1 (${PRODUCTOS_URL}): ${error.message}`);
  }

  if (!response.ok) {
    throw errorHttp(502, `El catalogo del Equipo 1 respondio HTTP ${response.status}`);
  }

  const data = await response.json().catch(() => null);

  if (!Array.isArray(data)) {
    throw errorHttp(502, 'El catalogo del Equipo 1 no devolvio una lista de productos');
  }

  return data;
}

async function productoDelCatalogo(id) {
  const productos = await catalogo();
  const producto = productos.find((p) => Number(p.id) === Number(id));

  if (!producto) {
    throw errorHttp(404, `El producto ${id} no existe en el catalogo del Equipo 1`);
  }

  return producto;
}

async function productoDelCatalogoPorNombre(nombre) {
  const buscado = String(nombre ?? '').trim().toLocaleLowerCase();

  if (!buscado) return null;

  const productos = await catalogo();
  return productos.find((p) => String(p.nombre ?? '').trim().toLocaleLowerCase() === buscado) || null;
}

/* ------------------------------------------------------------------ */
/* Existencias locales                                                 */
/* ------------------------------------------------------------------ */

async function existenciasDe(productoId) {
  const [filas] = await pool.execute(
    `SELECT ${CAMPOS_EXISTENCIA} FROM products WHERE id = ?`,
    [productoId]
  );
  return filas[0] || null;
}

function vistaInventario(producto, local) {
  return {
    id: Number(producto.id),
    productoId: Number(producto.id),
    nombre: producto.nombre ?? null,
    descripcion: (local && local.descripcion) || '',
    stock: Number(local && local.stock != null ? local.stock : 0),
    precio: numeroONull(primerDefinido(producto.precio, local && local.precio)) ?? 0,
    creado_en: (local && local.creado_en) || null,
    actualizado_en: (local && local.actualizado_en) || null
  };
}

function validarStock(body = {}) {
  const bruto = primerDefinido(body.stock, body.quantity);
  const stock = Number(bruto);

  if (bruto === null || !Number.isInteger(stock) || stock < 0) {
    return { error: "El campo 'stock' es obligatorio y debe ser un entero mayor o igual a cero" };
  }

  return { stock };
}

async function guardarExistencia(producto, stock, descripcion) {
  const existente = await existenciasDe(producto.id);
  const detalle = String(primerDefinido(descripcion, existente && existente.descripcion, ''));
  const precio = numeroONull(producto.precio) ?? 0;

  await pool.execute(
    `INSERT INTO products (id, name, description, quantity, price)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = ?, description = ?, quantity = ?, price = ?`,
    [producto.id, producto.nombre, detalle, stock, precio, producto.nombre, detalle, stock, precio]
  );

  return existenciasDe(producto.id);
}

/* ------------------------------------------------------------------ */
/* Notificaciones                                                      */
/* ------------------------------------------------------------------ */

async function notificar(mensaje, tipo = 'info') {
  if (!NOTIFICACIONES_URL) return;

  const body = JSON.stringify({
    servicio: 'inventario',
    service: 'inventory',
    mensaje,
    message: mensaje,
    tipo,
    type: tipo
  });

  let ultimoError = null;

  for (const basePath of NOTIFICACIONES_PATHS) {
    try {
      const response = await fetch(NOTIFICACIONES_URL + basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      if (response.ok) return;
      if (![404, 405].includes(response.status)) {
        console.error('Notificaciones respondio HTTP ' + response.status + ' en ' + basePath);
        return;
      }

      ultimoError = 'HTTP ' + response.status;
    } catch (error) {
      console.error('No se pudo enviar la notificacion:', error.message);
      return;
    }
  }

  if (ultimoError) {
    console.error('No se pudo enviar la notificacion en ninguna ruta:', ultimoError);
  }
}

/* ------------------------------------------------------------------ */
/* Rutas                                                               */
/* ------------------------------------------------------------------ */

const BASE_URL = PRODUCTOS_URL;

app.get('/', (req, res) => res.json({
  servicio: 'inventario',
  equipo: 'Equipo 3 - Inventario y Notificaciones',
  puertoInterno: PORT,
  responsabilidad: 'Inventario es la fuente oficial de las existencias (stock).',
  catalogo: BASE_URL,
  contrato: {
    request: ['productoId', 'stock', 'descripcion?'],
    response: ['id', 'productoId', 'nombre', 'descripcion', 'stock', 'precio']
  },
  endpoints: [
    'GET /health',
    'GET /',
    'GET /inventario',
    'GET /inventario/:productoId',
    'POST /inventario',
    'PUT /inventario/:productoId',
    'DELETE /inventario/:productoId',
    'GET /api/products (alias)',
    'GET /api/products/:id (alias)',
    'POST /api/products (alias)',
    'PUT /api/products/:id (alias)',
    'DELETE /api/products/:id (alias)'
  ]
}));

app.get('/health', async (_req, res) => {
  let baseDatos = 'ok';

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    baseDatos = 'error: ' + error.message;
  }

  let catalogoEstado = 'ok';

  try {
    await catalogo(CATALOGO_HEALTH_TIMEOUT_MS);
  } catch (error) {
    catalogoEstado = 'error: ' + error.message;
  }

  const ok = baseDatos === 'ok';

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'error',
    ok,
    servicio: 'inventario',
    service: 'inventory',
    estado: ok ? 'ok' : 'error',
    puertoInterno: PORT,
    baseDatos,
    catalogo: { url: PRODUCTOS_URL, estado: catalogoEstado }
  });
});

// Lista: catalogo del Equipo 1 enriquecido con las existencias locales.
// Rutas canonicas (/inventario) y alias heredados (/api/products).
app.get(['/inventario', '/api/products'], async (_req, res, next) => {
  try {
    const productos = await catalogo();
    const [filas] = await pool.query(`SELECT ${CAMPOS_EXISTENCIA} FROM products`);
    const porId = new Map(filas.map((fila) => [Number(fila.id), fila]));

    res.json(productos.map((producto) => vistaInventario(producto, porId.get(Number(producto.id)))));
  } catch (error) {
    next(error);
  }
});

app.get(['/inventario/:productoId', '/api/products/:id'], async (req, res, next) => {
  const id = parsearId(primerDefinido(req.params.productoId, req.params.id));

  if (id === null) {
    return res.status(400).json({ error: 'El id del producto debe ser un numero entero positivo' });
  }

  try {
    const producto = await productoDelCatalogo(id);
    res.json(vistaInventario(producto, await existenciasDe(id)));
  } catch (error) {
    next(error);
  }
});

// Registra existencias para un producto que YA existe en el catalogo del Equipo 1.
// Acepta { productoId, stock } (contrato acordado) o { nombre, stock, descripcion? }.
app.post(['/inventario', '/api/products'], async (req, res, next) => {
  const body = req.body || {};

  const { stock, error } = validarStock(body);
  if (error) return res.status(400).json({ error });

  try {
    const idBruto = primerDefinido(body.productoId, body.id);
    let producto;

    if (idBruto != null) {
      const id = parsearId(idBruto);

      if (id === null) {
        return res.status(400).json({ error: 'El id del producto debe ser un numero entero positivo' });
      }

      producto = await productoDelCatalogo(id);
    } else {
      producto = await productoDelCatalogoPorNombre(primerDefinido(body.nombre, body.name));
    }

    if (!producto) {
      throw errorHttp(404, 'El producto no existe en el catalogo del Equipo 1: crealo primero con el Equipo 1 (o envia productoId)');
    }

    const local = await guardarExistencia(producto, stock, primerDefinido(body.descripcion, body.description));
    await notificar(`Existencias registradas: ${producto.nombre} (${stock})`, 'success');

    res.status(201).json(vistaInventario(producto, local));
  } catch (error) {
    next(error);
  }
});

// Actualiza UNICAMENTE la existencia; el nombre y el precio son del catalogo y se ignoran.
app.put(['/inventario/:productoId', '/api/products/:id'], async (req, res, next) => {
  const id = parsearId(primerDefinido(req.params.productoId, req.params.id));

  if (id === null) {
    return res.status(400).json({ error: 'El id del producto debe ser un numero entero positivo' });
  }

  const body = req.body || {};
  const { stock, error } = validarStock(body);
  if (error) return res.status(400).json({ error });

  try {
    const producto = await productoDelCatalogo(id);
    const local = await guardarExistencia(producto, stock, primerDefinido(body.descripcion, body.description));
    await notificar(`Existencias actualizadas: ${producto.nombre} (${stock})`, 'info');

    res.json(vistaInventario(producto, local));
  } catch (error) {
    next(error);
  }
});

// Elimina el registro de existencias (no el producto del catalogo del Equipo 1).
app.delete(['/inventario/:productoId', '/api/products/:id'], async (req, res, next) => {
  const id = parsearId(primerDefinido(req.params.productoId, req.params.id));

  if (id === null) {
    return res.status(400).json({ error: 'El id del producto debe ser un numero entero positivo' });
  }

  try {
    const producto = await productoDelCatalogo(id);
    const local = await existenciasDe(id);

    if (!local) {
      throw errorHttp(404, 'No hay registro de existencias para ese producto');
    }

    await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    await notificar(`Registro de existencias eliminado: ${producto.nombre}`, 'warning');

    res.json({
      mensaje: 'Registro de existencias eliminado; el producto sigue en el catalogo del Equipo 1',
      productoId: id
    });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((error, _req, res, _next) => {
  const estado = Number(error.status) || 500;

  if (estado >= 500) console.error(error);

  res.status(estado).json({
    error: estado === 400
      ? 'El cuerpo de la peticion no es JSON valido'
      : error.message || 'Error interno del servicio inventario'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Microservicio de Inventario escuchando en ${PORT}; catalogo: ${PRODUCTOS_URL}`);
});
