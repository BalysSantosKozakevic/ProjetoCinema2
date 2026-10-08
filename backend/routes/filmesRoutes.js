const express = require('express'), { Cinema } = require('../infrastructure/filmesInfrastructure'); const router = express.Router(), c = new Cinema();

const auth = async (req, res, next) => {
  try {
    const u = await c.usuario((req.headers.authorization || '').replace(/^Bearer /, '')); if (!u) return res.status(401).json({ erro: 'Faça login para continuar.' }); req.user = u;

    next()
  } catch (e) { next(e) }
};

router.get('/filmes', async (req, res, next) => { try { res.json(await c.filmes({ busca: req.query.busca || '', genero: req.query.genero || '' })) } catch (e) { next(e) } });

router.get('/filmes/:id', async (req, res, next) => {
  try {
    const x = await c.filme(Number(req.params.id));

    if (!x) return res.status(404).json({ erro: 'Filme não encontrado.' }); res.json(x)
  } catch (e) { next(e) }
});

router.get('/generos', async (_req, res, next) => { try { res.json(await c.generos()) } catch (e) { next(e) } });

router.get('/sessoes/:id/assentos', async (req, res, next) => { try { res.json(await c.assentos(Number(req.params.id))) } catch (e) { next(e) } });

router.get('/filmes/:id/sessoes', async (req, res, next) => { try { res.json(await c.sessoes(Number(req.params.id), { data: req.query.data || '', shopping: req.query.shopping || '' })) } catch (e) { next(e) } });

router.post('/contas', async (req, res, next) => { try { res.status(201).json(await c.criarConta(req.body)) } catch (e) { next(e) } });

router.post('/contas/verificar', async (req, res, next) => { try { res.json(await c.verificar(req.body.token)) } catch (e) { next(e) } });

router.post('/login', async (req, res, next) => { try { res.json(await c.login(req.body)) } catch (e) { next(e) } });

router.get('/me', auth, (req, res) => res.json(req.user));

router.get('/me/pedidos', auth, async (req, res, next) => { try { res.json(await c.pedidos(req.user.id)) } catch (e) { next(e) } });

router.post('/compras', auth, async (req, res, next) => {
  try {
    const b = req.body; if (!['inteira', 'meia', 'plano'].includes(b.tipo)) return res.status(400).json({ erro: 'Tipo de ingresso inválido.' });

    if (!Array.isArray(b.assentoIds) || !b.assentoIds.length) return res.status(400).json({ erro: 'Selecione pelo menos um assento.' });

    res.status(201).json(await c.comprar({ usuarioId: req.user.id, sessaoId: Number(b.sessaoId), tipo: b.tipo, assentoIds: b.assentoIds, comboQuantidade: b.comboQuantidade }))
  } catch (e) { next(e) }
});

router.post('/pedidos/:id/cancelar', auth, async (req, res, next) => { try { res.json(await c.cancelar(req.user.id, Number(req.params.id))) } catch (e) { next(e) } });

router.post('/pedidos/:id/reembolso', auth, async (req, res, next) => { try { res.json(await c.reembolso(req.user.id, Number(req.params.id))) } catch (e) { next(e) } });

module.exports = router;