const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());
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

async function notify(message, type = 'info') {
  const base = process.env.NOTIFICATIONS_URL;
  if (!base) return;
  try {
    await fetch(`${base}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'inventory', message, type })
    });
  } catch (error) {
    console.error('No se pudo enviar la notificación:', error.message);
  }
}

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ service: 'inventory', status: 'ok' }); }
  catch (e) { res.status(503).json({ service: 'inventory', status: 'error', message: e.message }); }
});
app.get('/api/products', async (_req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC'); res.json(rows); }
  catch (e) { res.status(500).json({ error: 'No se pudieron consultar los productos', detail: e.message }); }
});
app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo consultar el producto', detail: e.message }); }
});
app.post('/api/products', async (req, res) => {
  const { name, description = '', quantity = 0, price = 0 } = req.body || {};
  if (!name || !Number.isInteger(Number(quantity)) || Number(quantity) < 0 || !Number.isFinite(Number(price)) || Number(price) < 0)
    return res.status(400).json({ error: 'name es obligatorio; quantity y price deben ser números no negativos' });
  try {
    const [result] = await pool.execute('INSERT INTO products (name, description, quantity, price) VALUES (?, ?, ?, ?)', [name, description, Number(quantity), Number(price)]);
    const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
    await notify(`Producto creado: ${name}`, 'success');
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo crear el producto', detail: e.message }); }
});
app.put('/api/products/:id', async (req, res) => {
  const { name, description = '', quantity, price } = req.body || {};
  if (!name || !Number.isInteger(Number(quantity)) || Number(quantity) < 0 || !Number.isFinite(Number(price)) || Number(price) < 0)
    return res.status(400).json({ error: 'name es obligatorio; quantity y price deben ser números no negativos' });
  try {
    const [result] = await pool.execute('UPDATE products SET name=?, description=?, quantity=?, price=? WHERE id=?', [name, description, Number(quantity), Number(price), req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
    await notify(`Producto actualizado: ${name}`, 'info');
    const [rows] = await pool.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'No se pudo actualizar el producto', detail: e.message }); }
});
app.delete('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT name FROM products WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    await pool.execute('DELETE FROM products WHERE id=?', [req.params.id]);
    await notify(`Producto eliminado: ${rows[0].name}`, 'warning');
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (e) { res.status(500).json({ error: 'No se pudo eliminar el producto', detail: e.message }); }
});
app.listen(port, () => console.log(`Inventory service escuchando en puerto ${port}`));
