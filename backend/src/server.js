import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import arRoutes from './routes/ar.js';
import authRoutes from './routes/auth.js';
import commonRoutes from './routes/common.js';
import hodRoutes from './routes/hod.js';
import lecturerRoutes from './routes/lecturer.js';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/hod', authenticate, requireRole('HOD'), hodRoutes);
app.use('/api/lecturer', authenticate, requireRole('LECTURER'), lecturerRoutes);
app.use('/api/ar', authenticate, requireRole('AR'), arRoutes);
app.use('/api', commonRoutes);

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

const port = Number(process.env.PORT || 5050);
app.listen(port, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the other server or change PORT in .env` : err.message);
    process.exit(1);
  }
  console.log(`API running on http://localhost:${port}`);
  pool
    .query('SELECT 1')
    .then(() => console.log(`Connected to MySQL database "${process.env.DB_NAME || 'exam_info_system'}"`))
    .catch((e) => console.error(`Cannot connect to MySQL (${e.message}). Check the DB_* settings in backend/.env`));
});
