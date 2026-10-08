const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'bdcinema',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(config);

async function testarConexao() {
  const c = await pool.getConnection();
  try {
    await c.ping();
  } finally {
    c.release();
  }
}

// O projeto usa um banco já existente. Esta função apenas valida a conexão;
// ela não cria outro banco nem executa consultas automaticamente durante o import.
async function inicializarBanco() {
  await testarConexao();
}

module.exports = { pool, testarConexao, inicializarBanco };
