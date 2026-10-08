require('dotenv').config();

const express = require('express'), cors = require('cors'), { inicializarBanco, testarConexao } = require('./config/db'), routes = require('./routes/filmesRoutes');

const app = express(), PORT = Number(process.env.PORT || 3000); app.disable('x-powered-by'); app.use(cors({ origin: true })); app.use(express.json({ limit: '1mb' }));

app.get('/', (_q, r) => r.json({ nome: 'Cinemasso Cinema', status: 'online', versao: '3.0.0' }));

app.get('/health', async (_q, r) => { try { await testarConexao(); r.json({ status: 'ok', banco: 'conectado' }) } catch (e) { r.status(503).json({ status: 'degradado', banco: 'indisponível' }) } });

app.use('/api', routes); app.use((_q, r) => r.status(404).json({ erro: 'Rota não encontrada.' })); app.use((e, _q, r, _n) => { console.error(e); r.status(e.status || 500).json({ erro: e.message || 'Erro interno.' }) });

async function iniciar() {
  try {
    await inicializarBanco();

    console.log('Banco Cinemasso inicializado.')
  } catch (e) { console.error('Banco:', e.message) } app.listen(PORT, () => console.log(`Cinemasso em http://localhost:${PORT}`))
} if (require.main === module) iniciar();

module.exports = app;