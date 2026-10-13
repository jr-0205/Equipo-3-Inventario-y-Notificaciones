const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const port = Number(process.env.PORT || 3001);
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servicio: 'inventario', mensaje, tipo })
    });
  } catch (error) {
    console.error('No se pudo enviar la notificación:', error.message);
  }
}

function validarProducto(body) {
  const nombre = String(body?.nombre ?? '').trim();
  const descripcion = String(body?.descripcion ?? '');
  const stock = Number(body?.stock);
  const precio = Number(body?.precio);
  if (!nombre) return 'nombre es obligatorio';
  if (!Number.isInteger(stock) || stock < 0) return 'stock debe ser un entero mayor o igual a cero';
  if (!Number.isFinite(precio) || precio < 0) return 'precio debe ser un número no negativo';
  return { nombre, descripcion, stock, precio };
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ servicio: 'inventario', estado: 'ok' });
  } catch (e) {
    res.status(503).json({ servicio: 'inventario', estado: 'error', mensaje: e.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, descripcion, stock, precio, creado_en, actualizado_en FROM products ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo consultar el inventario', detalle: e.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, nombre, descripcion, stock, precio, creado_en, actualizado_en FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo consultar el producto', detalle: e.message });
  }
});

app.post('/api/products', async (req, res) => {
  const producto = validarProducto(req.body || {});
  if (typeof producto === 'string') return res.status(400).json({ error: producto });
  try {
    const [result] = await pool.execute('INSERT INTO products (nombre, descripcion, stock, precio) VALUES (?, ?, ?, ?)', [producto.nombre, producto.descripcion, producto.stock, producto.precio]);
    const [rows] = await pool.execute('SELECT id, nombre, descripcion, stock, precio, creado_en, actualizado_en FROM products WHERE id = ?', [result.insertId]);
    await notify(`Producto creado: ${producto.nombre}`, 'success');
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el producto', detalle: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const producto = validarProducto(req.body || {});
  if (typeof producto === 'string') return res.status(400).json({ error: producto });
  try {
    const [result] = await pool.execute('UPDATE products SET nombre=?, descripcion=?, stock=?, precio=? WHERE id=?', [producto.nombre, producto.descripcion, producto.stock, producto.precio, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
    const [rows] = await pool.execute('SELECT id, nombre, descripcion, stock, precio, creado_en, actualizado_en FROM products WHERE id = ?', [req.params.id]);
    await notify(`Producto actualizado: ${producto.nombre}`, 'info');
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar el producto', detalle: e.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT nombre FROM products WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    await pool.execute('DELETE FROM products WHERE id=?', [req.params.id]);
    await notify(`Producto eliminado: ${rows[0].nombre}`, 'warning');
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar el producto', detalle: e.message });
  }
});

app.listen(port, () => console.log(`Microservicio de Inventario escuchando en ${port}`));
