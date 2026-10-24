import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please log in'));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Please log in again'));
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'You do not have access to this page'));
