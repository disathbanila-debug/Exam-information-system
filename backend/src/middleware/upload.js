import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { HttpError } from './errors.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const base = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'document';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}.pdf`);
  },
});

/** Accepts a single PDF in the multipart field "file". */
export const uploadPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(isPdf ? null : new HttpError(400, 'Only PDF files can be uploaded'), isPdf);
  },
}).single('file');

export function requireFile(req) {
  if (!req.file) throw new HttpError(400, 'Please attach a PDF file');
  return req.file.filename;
}
