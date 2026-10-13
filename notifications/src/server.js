const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
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
    res.json({ servicio: 'notificaciones', estado: 'ok' });
  } catch (e) {
    res.status(503).json({ servicio: 'notificaciones', estado: 'error', mensaje: e.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 50, 1), 200);
  try {
    const [rows] = await pool.execute('SELECT id, service AS servicio, message AS mensaje, type AS tipo, created_at AS creado_en FROM notifications ORDER BY id DESC LIMIT ?', [limite]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron consultar las notificaciones', detalle: e.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  const servicio = String(req.body?.servicio || 'aplicacion').trim();
  const mensaje = req.body?.mensaje;
  const tipo = String(req.body?.tipo || 'info').trim();
  if (typeof mensaje !== 'string' || !mensaje.trim()) return res.status(400).json({ error: 'mensaje es obligatorio y debe ser texto' });
  try {
    const [result] = await pool.execute('INSERT INTO notifications (service, message, type) VALUES (?, ?, ?)', [servicio, mensaje.trim(), tipo]);
    const [rows] = await pool.execute('SELECT id, service AS servicio, message AS mensaje, type AS tipo, created_at AS creado_en FROM notifications WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo registrar la notificación', detalle: e.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ mensaje: 'Notificación eliminada correctamente' });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar la notificación', detalle: e.message });
  }
});

app.listen(port, () => console.log(`Microservicio de Notificaciones escuchando en ${port}`));
