import fs from 'node:fs';
import multer from 'multer';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // a request that failed validation should not leave its uploaded PDF behind
  if (req.file?.path) fs.unlink(req.file.path, () => {});

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The PDF must be 10 MB or smaller' : err.message;
    return res.status(400).json({ message });
  }
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This record already exists' });
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({ message: 'Some values are not valid for this record' });
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message });
  if (['ER_ACCESS_DENIED_ERROR', 'ECONNREFUSED', 'ER_BAD_DB_ERROR'].includes(err.code)) {
    console.error(`Database connection failed: ${err.message}`);
    return res.status(503).json({ message: 'Cannot connect to the database. Check the DB settings in backend/.env' });
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server' });
}
