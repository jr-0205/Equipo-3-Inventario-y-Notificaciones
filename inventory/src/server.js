const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const port = Number(process.env.PORT || 3001);
const PRODUCTOS_URL = (process.env.PRODUCTOS_URL || 'http://host.docker.internal:2502').replace(/\/$/, '');
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'team3_app',
  password: process.env.DB_PASSWORD || 'team3pass123',
  database: process.env.DB_NAME || 'team3_inventory',
  waitForConnections: true,
  connectionLimit: 10
});

async function notify(mensaje, tipo = 'info') {
  const base = process.env.NOTIFICATIONS_URL;
  if (!base) return;
  try {
    await fetch(`${base}/api/notifications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servicio: 'inventario', mensaje, tipo })
    });
  } catch (error) { console.error('No se pudo enviar la notificación:', error.message); }
}

async function catalogo() {
  const response = await fetch(`${PRODUCTOS_URL}/productos`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Productos respondió HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('La API de Productos no devolvió una lista');
  return data;
}
async function obtenerProducto(id) {
  const productos = await catalogo();
  const producto = productos.find(p => Number(p.id) === Number(id));
  if (!producto) {
    const error = new Error('El producto no existe en el catálogo del Equipo 1');
    error.status = 404;
    throw error;
  }
  return producto;
}
async function obtenerStockPorNombre(nombre) {
  const [rows] = await pool.execute('SELECT id, quantity, description, created_at, updated_at FROM products WHERE LOWER(name)=LOWER(?) LIMIT 1', [nombre]);
  return rows[0] || null;
}
async function vistaInventario(producto) {
  const local = await obtenerStockPorNombre(producto.nombre);
  return {
    id: Number(producto.id), nombre: producto.nombre,
    descripcion: local?.description || '',
    stock: Number(local?.quantity || 0),
    precio: Number(producto.precio),
    creado_en: local?.created_at || null,
    actualizado_en: local?.updated_at || null
  };
}
function validarStock(body) {
  const stock = Number(body?.stock);
  if (!Number.isInteger(stock) || stock < 0) return 'stock debe ser un entero mayor o igual a cero';
  return stock;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ servicio: 'inventario', estado: 'ok', catalogo: PRODUCTOS_URL });
  } catch (e) { res.status(503).json({ servicio: 'inventario', estado: 'error', mensaje: e.message }); }
});

app.get('/api/products', async (_req, res) => {
  try {
    const productos = await catalogo();
    res.json(await Promise.all(productos.map(vistaInventario)));
  } catch (e) {
    res.status(502).json({ error: 'No se pudo consultar el catálogo para mostrar inventario', detalle: e.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try { res.json(await vistaInventario(await obtenerProducto(req.params.id))); }
  catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
  try {
    const producto = req.body?.productoId != null
      ? await obtenerProducto(req.body.productoId)
      : (await catalogo()).find(p => String(p.nombre).trim().toLocaleLowerCase() === String(req.body?.nombre || '').trim().toLocaleLowerCase());
    if (!producto) return res.status(404).json({ error: 'Primero crea el producto en el catálogo del Equipo 1.' });
    const stock = validarStock(req.body);
    if (typeof stock === 'string') return res.status(400).json({ error: stock });
    const existente = await obtenerStockPorNombre(producto.nombre);
    if (existente) {
      await pool.execute('UPDATE products SET quantity=?, description=? WHERE id=?', [stock, String(req.body?.descripcion || existente.description || ''), existente.id]);
    } else {
      await pool.execute('INSERT INTO products (name, description, quantity, price) VALUES (?, ?, ?, ?)', [producto.nombre, String(req.body?.descripcion || ''), stock, Number(producto.precio)]);
    }
    await notify(`Existencias registradas: ${producto.nombre}`, 'success');
    res.status(201).json(await vistaInventario(producto));
  } catch (e) { res.status(e.status || 502).json({ error: 'No se pudo registrar la existencia', detalle: e.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const producto = await obtenerProducto(req.params.id);
    const stock = validarStock(req.body);
    if (typeof stock === 'string') return res.status(400).json({ error: stock });
    const existente = await obtenerStockPorNombre(producto.nombre);
    if (existente) {
      await pool.execute('UPDATE products SET quantity=? WHERE id=?', [stock, existente.id]);
    } else {
      await pool.execute('INSERT INTO products (name, description, quantity, price) VALUES (?, ?, ?, ?)', [producto.nombre, '', stock, Number(producto.precio)]);
    }
    await notify(`Existencias actualizadas: ${producto.nombre} (${stock})`, 'info');
    res.json(await vistaInventario(producto));
  } catch (e) { res.status(e.status || 502).json({ error: 'No se pudo actualizar la existencia', detalle: e.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const producto = await obtenerProducto(req.params.id);
    const existente = await obtenerStockPorNombre(producto.nombre);
    if (!existente) return res.status(404).json({ error: 'No hay registro de existencias para este producto' });
    await pool.execute('DELETE FROM products WHERE id=?', [existente.id]);
    await notify(`Registro de existencias eliminado: ${producto.nombre}`, 'warning');
    res.json({ mensaje: 'Registro de existencias eliminado; el producto sigue en el catálogo', productoId: Number(producto.id) });
  } catch (e) { res.status(e.status || 502).json({ error: 'No se pudo eliminar el registro de inventario', detalle: e.message }); }
});

app.listen(port, () => console.log(`Microservicio de Inventario escuchando en ${port}; catálogo: ${PRODUCTOS_URL}`));
