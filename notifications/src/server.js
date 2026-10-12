const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());
const port = Number(process.env.PORT || 3002);
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'team3_app',
  password: process.env.DB_PASSWORD || 'team3pass123',
  database: process.env.DB_NAME || 'team3_inventory',
  waitForConnections: true,
  connectionLimit: 10
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ service: 'notifications', status: 'ok' });
  } catch (e) {
    res.status(503).json({ service: 'notifications', status: 'error', message: e.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
  try {
    const [rows] = await pool.execute('SELECT * FROM notifications ORDER BY id DESC LIMIT ?', [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron consultar las notificaciones', detail: e.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { service = 'app', message, type = 'info' } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message es obligatorio y debe ser texto' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO notifications (service, message, type) VALUES (?, ?, ?)',
      [String(service), message, String(type)]
    );
    const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo registrar la notificación', detail: e.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ message: 'Notificación eliminada correctamente' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar la notificación', detail: e.message });
  }
});

app.listen(port, () => console.log(`Notifications service escuchando en puerto ${port}`));
