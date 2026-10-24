import { HttpError } from '../middleware/errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

export function text(v, field, { required = true, max = 255 } = {}) {
  if (blank(v)) {
    if (required) throw new HttpError(400, `${field} is required`);
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return s;
}

export function int(v, field, { min, max, required = true } = {}) {
  if (blank(v)) {
    if (required) throw new HttpError(400, `${field} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || (min !== undefined && n < min) || (max !== undefined && n > max)) {
    throw new HttpError(400, `${field} must be a whole number${min !== undefined ? ` between ${min} and ${max}` : ''}`);
  }
  return n;
}

export function decimal(v, field, { min = 0, max = 100 } = {}) {
  const n = Number(v);
  if (blank(v) || Number.isNaN(n) || n < min || n > max) {
    throw new HttpError(400, `${field} must be a number between ${min} and ${max}`);
  }
  return Math.round(n * 100) / 100;
}

export function date(v, field, { required = true } = {}) {
  if (blank(v)) {
    if (required) throw new HttpError(400, `${field} is required`);
    return null;
  }
  const s = String(v).trim();
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw new HttpError(400, `${field} must be a valid date`);
  return s;
}

export function time(v, field) {
  const s = blank(v) ? '' : String(v).trim();
  if (!TIME_RE.test(s)) throw new HttpError(400, `${field} must be a valid time`);
  return s.length === 5 ? `${s}:00` : s;
}

export function dateTime(v, field) {
  const m = blank(v) ? null : String(v).trim().match(DATETIME_RE);
  if (!m) throw new HttpError(400, `${field} must be a valid date and time`);
  return `${m[1]} ${m[2]}${m[3] || ':00'}`;
}

export function email(v, field = 'Email') {
  const s = text(v, field, { max: 120 }).toLowerCase();
  if (!EMAIL_RE.test(s)) throw new HttpError(400, `${field} is not a valid email address`);
  return s;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nowStr() {
  const d = new Date();
  return `${todayStr()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}
