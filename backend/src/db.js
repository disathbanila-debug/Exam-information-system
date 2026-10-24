import 'dotenv/config';
import mysql from 'mysql2/promise';

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'exam_info_system',
  dateStrings: true, // DATE -> 'YYYY-MM-DD', DATETIME -> 'YYYY-MM-DD HH:MM:SS'
};

export const pool = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10 });

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Runs fn(conn) inside a transaction; conn.q(sql, params) returns rows. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  conn.q = async (sql, params = []) => (await conn.query(sql, params))[0];
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
