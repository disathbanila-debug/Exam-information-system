import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();

async function loadUser(where, params) {
  const [u] = await query(
    `SELECT u.*, d.dept_name, f.faculty_name
     FROM users u
     LEFT JOIN departments d ON d.dept_id = u.dept_id
     LEFT JOIN faculties f ON f.faculty_id = d.faculty_id
     WHERE ${where} AND u.is_active = 1`,
    params,
  );
  return u;
}

const publicUser = (u) => ({
  user_id: u.user_id,
  role: u.role,
  name: `${u.title} ${u.initials} ${u.surname}`,
  title: u.title,
  initials: u.initials,
  surname: u.surname,
  designation: u.designation,
  email: u.email,
  grade_level: u.grade_level,
  dept_name: u.dept_name,
  faculty_name: u.faculty_name,
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const u = await loadUser('u.email = ?', [email]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  const token = jwt.sign({ user_id: u.user_id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: publicUser(u) });
});

router.get('/me', authenticate, async (req, res) => {
  const u = await loadUser('u.user_id = ?', [req.user.user_id]);
  if (!u) throw new HttpError(401, 'Your account is no longer active');
  res.json({ user: publicUser(u) });
});

export default router;
