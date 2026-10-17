const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 3006);

// El contrato oficial es en español; se conservan alias en inglés por compatibilidad.
const CAMPOS_NOTIFICACION = `
  id,
  service AS servicio, service,
  message AS mensaje, message,
  type AS tipo, type,
  created_at AS creado_en, created_at
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

app.get('/', (req, res) => res.json({
  servicio: 'notificaciones',
  equipo: 'Equipo 3 - Inventario y Notificaciones',
  puertoInterno: PORT,
  contrato: {
    request: ['servicio', 'mensaje', 'tipo?'],
    response: ['id', 'servicio', 'mensaje', 'tipo', 'creado_en']
  },
  endpoints: [
    'GET /health',
    'GET /',
    'GET /notificaciones?limite=30',
    'POST /notificaciones',
    'DELETE /notificaciones/:id',
    'GET|POST /api/notifications (alias)'
  ]
}));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      ok: true,
      servicio: 'notificaciones',
      service: 'notifications',
      estado: 'ok',
      puertoInterno: PORT,
      baseDatos: 'ok'
    });
  } catch (e) {
    res.status(503).json({
      status: 'error',
      ok: false,
      servicio: 'notificaciones',
      service: 'notifications',
      estado: 'error',
      error: e.message
    });
  }
});

// Rutas canónicas (/notificaciones) y alias heredados (/api/notifications).
// Acepta ?limite= (oficial) y ?limit= (heredado).
app.get(['/notificaciones', '/api/notifications'], async (req, res) => {
  const limite = Math.min(Math.max(Number.parseInt(primerDefinido(req.query.limite, req.query.limit), 10) || 50, 1), 200);

  try {
    const [rows] = await pool.execute(`SELECT ${CAMPOS_NOTIFICACION} FROM notifications ORDER BY id DESC LIMIT ?`, [limite]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron consultar las notificaciones', detalle: e.message });
  }
});

app.post(['/notificaciones', '/api/notifications'], async (req, res) => {
  const body = req.body || {};
  const servicio = String(primerDefinido(body.servicio, body.service, 'aplicacion')).trim();
  const mensaje = primerDefinido(body.mensaje, body.message);
  const tipo = String(primerDefinido(body.tipo, body.type, 'info')).trim();

  if (typeof mensaje !== 'string' || !mensaje.trim()) {
    return res.status(400).json({ error: "El campo 'mensaje' es obligatorio y debe ser texto" });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO notifications (service, message, type) VALUES (?, ?, ?)',
      [servicio, mensaje.trim(), tipo]
    );
    const [rows] = await pool.execute(`SELECT ${CAMPOS_NOTIFICACION} FROM notifications WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo registrar la notificación', detalle: e.message });
  }
});

app.delete(['/notificaciones/:id', '/api/notifications/:id'], async (req, res) => {
  const id = parsearId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'El id debe ser un número entero positivo' });

  try {
    const [result] = await pool.execute('DELETE FROM notifications WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ mensaje: 'Notificación eliminada correctamente', id });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar la notificación', detalle: e.message });
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((error, _req, res, _next) => {
  const estado = Number(error.status || error.statusCode) || 500;
  if (estado >= 500) console.error(error);
  res.status(estado).json({
    error: estado === 400
      ? 'El cuerpo de la petición no es JSON válido'
      : 'Error interno del servicio notificaciones'
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Microservicio de Notificaciones escuchando en ${PORT}`));
