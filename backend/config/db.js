const mysql = require('mysql2/promise');
require('dotenv').config();

const config = { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD ?? 'root', database: process.env.DB_NAME || 'bdcinemasso', waitForConnections: true, connectionLimit: 10, queueLimit: 0 };
const pool = mysql.createPool(config);
async function testarConexao() { const c = await pool.getConnection(); try { await c.ping() } finally { c.release() } }
async function inicializarBanco() {
    const admin = mysql.createPool({ ...config, database: undefined }); const c = await admin.getConnection();
}

const [a] = await pool.query('SELECT COUNT(*) n FROM assentos'); if (!Number(a[0].n)) { const [ss] = await pool.query('SELECT id FROM sessoes'); for (const x of ss) { let v = []; for (let r = 0; r < 6; r++)for (let n = 1; n <= 8; n++)v.push([x.id, String.fromCharCode(65 + r) + n]); await pool.query('INSERT INTO assentos(sessao_id,codigo) VALUES ' + v.map(() => '(?,?)').join(','), v.flat()) } }

module.exports = { pool, testarConexao, inicializarBanco };
