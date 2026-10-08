require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { inicializarBanco, testarConexao } = require('./config/db');
const routes = require('./routes/filmesRoutes');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ nome: 'Cinemasso Cinema', status: 'online', versao: '3.1.0' });
});

app.get('/health', async (_req, res) => {
  try {
    await testarConexao();
    res.json({ status: 'ok', banco: 'conectado' });
  } catch (error) {
    console.error('Health check do banco:', error.message);
    res.status(503).json({ status: 'degradado', banco: 'indisponível' });
  }
});

app.use('/api', routes);

app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    erro: error.message || 'Erro interno do servidor.'
  });
});

async function iniciar() {
  try {
    await inicializarBanco();
    console.log('Banco Cinemasso conectado.');
  } catch (error) {
    console.error('\nNão foi possível conectar ao banco de dados.');
    console.error('Verifique backend/.env e confirme que o MySQL está ligado.');
    console.error(`Detalhes: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  app.listen(PORT, () => {
    console.log(`Cinemasso em http://localhost:${PORT}`);
  });
}

if (require.main === module) iniciar();

module.exports = app;
