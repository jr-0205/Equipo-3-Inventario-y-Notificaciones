const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3005);
// Nombre oficial en espanol (igual que el Equipo 2 y el reglamento); se acepta el
// heredado en ingles para no romper configuraciones anteriores.
const NOTIFICACIONES_URL = String(process.env.NOTIFICACIONES_URL || process.env.NOTIFICATIONS_URL || '').trim().replace(/\/+$/, '');

// Ruta canónica acordada en reglas.md y ruta heredada que ya usaba el proyecto.
const NOTIFICACIONES_PATHS = ['/notificaciones', '/api/notifications'];

// El contrato oficial es en español; se conservan alias en inglés por compatibilidad.
const CAMPOS_PRODUCTO = `
  id,
  name AS nombre, name,
  description AS descripcion, description,
  quantity AS stock, quantity,
  price AS precio, price,
  created_at AS creado_en, created_at,
  updated_at AS actualizado_en, updated_at
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

// Acepta el vocabulario en español (oficial) y el inglés (heredado).
function validarProducto(body = {}, actual = null) {
  const nombre = String(primerDefinido(body.nombre, body.name, actual && actual.nombre) ?? '').trim();
  const descripcion = String(primerDefinido(body.descripcion, body.description, actual && actual.descripcion) ?? '');
  const stockBruto = primerDefinido(body.stock, body.quantity, actual && actual.stock, 0);
  const precioBruto = primerDefinido(body.precio, body.price, actual && actual.precio, 0);
  const stock = Number(stockBruto);
  const precio = Number(precioBruto);

  if (!nombre) return { error: "El campo 'nombre' es obligatorio" };
  if (!Number.isInteger(stock) || stock < 0) return { error: "El campo 'stock' debe ser un entero mayor o igual a cero" };
  if (!Number.isFinite(precio) || precio < 0) return { error: "El campo 'precio' debe ser un número mayor o igual a cero" };
  return { nombre, descripcion, stock, precio };
}

// Avisa al microservicio de Notificaciones con ambos vocabularios y probando
// primero la ruta canónica.
async function notificar(mensaje, tipo = 'info') {
  if (!NOTIFICACIONES_URL) return;

  const body = JSON.stringify({
    servicio: 'inventario', service: 'inventory',
    mensaje, message: mensaje,
    tipo, type: tipo
  });

  for (const basePath of NOTIFICACIONES_PATHS) {
    try {
      const response = await fetch(NOTIFICACIONES_URL + basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (response.ok) return;
      if (![404, 405].includes(response.status)) {
        console.error('Notificaciones respondió HTTP ' + response.status + ' en ' + basePath);
        return;
      }
    } catch (error) {
      console.error('No se pudo enviar la notificación:', error.message);
      return;
    }
  }
}

app.get('/', (req, res) => res.json({
  servicio: 'inventario',
  equipo: 'Equipo 3 - Inventario y Notificaciones',
  puertoInterno: PORT,
  contrato: {
    request: ['nombre', 'stock', 'precio', 'descripcion?'],
    response: ['id', 'nombre', 'descripcion', 'stock', 'precio', 'creado_en', 'actualizado_en']
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
    'GET /api/products/:id (alias)'
  ]
}));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      ok: true,
      servicio: 'inventario',
      service: 'inventory',
      estado: 'ok',
      puertoInterno: PORT,
      baseDatos: 'ok'
    });
  } catch (e) {
    res.status(503).json({
      status: 'error',
      ok: false,
      servicio: 'inventario',
      service: 'inventory',
      estado: 'error',
      error: e.message
    });
  }
});

// Rutas canónicas (/inventario) y alias heredados (/api/products).
app.get(['/inventario', '/api/products'], async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${CAMPOS_PRODUCTO} FROM products ORDER BY id DESC`);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo consultar el inventario', detalle: e.message });
  }
});

app.get(['/inventario/:productoId', '/api/products/:id'], async (req, res) => {
  const id = parsearId(primerDefinido(req.params.productoId, req.params.id));
  if (id === null) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

  try {
    const [rows] = await pool.execute(`SELECT ${CAMPOS_PRODUCTO} FROM products WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo consultar el producto', detalle: e.message });
  }
});

app.post(['/inventario', '/api/products'], async (req, res) => {
  const producto = validarProducto(req.body || {});
  if (producto.error) return res.status(400).json({ error: producto.error });

  try {
    const [result] = await pool.execute(
      'INSERT INTO products (name, description, quantity, price) VALUES (?, ?, ?, ?)',
      [producto.nombre, producto.descripcion, producto.stock, producto.precio]
    );
    const [rows] = await pool.execute(`SELECT ${CAMPOS_PRODUCTO} FROM products WHERE id = ?`, [result.insertId]);
    await notificar(`Producto creado: ${producto.nombre}`, 'success');
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el producto', detalle: e.message });
  }
});

app.put(['/inventario/:productoId', '/api/products/:id'], async (req, res) => {
  const id = parsearId(primerDefinido(req.params.productoId, req.params.id));
  if (id === null) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

  try {
    const [actuales] = await pool.execute(`SELECT ${CAMPOS_PRODUCTO} FROM products WHERE id = ?`, [id]);
    if (!actuales.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const producto = validarProducto(req.body || {}, actuales[0]);
    if (producto.error) return res.status(400).json({ error: producto.error });

    await pool.execute(
      'UPDATE products SET name = ?, description = ?, quantity = ?, price = ? WHERE id = ?',
      [producto.nombre, producto.descripcion, producto.stock, producto.precio, id]
    );
    const [rows] = await pool.execute(`SELECT ${CAMPOS_PRODUCTO} FROM products WHERE id = ?`, [id]);
    await notificar(`Producto actualizado: ${producto.nombre}`, 'info');
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el producto', detalle: e.message });
  }
});

app.delete(['/inventario/:productoId', '/api/products/:id'], async (req, res) => {
  const id = parsearId(primerDefinido(req.params.productoId, req.params.id));
  if (id === null) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

  try {
    const [rows] = await pool.execute(`SELECT ${CAMPOS_PRODUCTO} FROM products WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

    await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    await notificar(`Producto eliminado: ${rows[0].nombre}`, 'warning');
    res.json({ mensaje: 'Producto eliminado correctamente', id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar el producto', detalle: e.message });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((error, _req, res, _next) => {
  const estado = Number(error.status || error.statusCode) || 500;
  if (estado >= 500) console.error(error);
  res.status(estado).json({
    error: estado === 400
      ? 'El cuerpo de la petición no es JSON válido'
      : 'Error interno del servicio inventario'
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Microservicio de Inventario escuchando en ${PORT}`));
