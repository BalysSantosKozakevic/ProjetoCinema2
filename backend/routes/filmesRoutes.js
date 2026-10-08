const express = require('express');
const { Cinema } = require('../infrastructure/filmesInfrastructure');

const router = express.Router();
const cinema = new Cinema();

async function auth(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    const usuario = await cinema.usuario(token);

    if (!usuario) {
      return res.status(401).json({ erro: 'Faça login para continuar.' });
    }

    req.user = usuario;
    next();
  } catch (error) {
    next(error);
  }
}

router.get('/filmes', async (req, res, next) => {
  try {
    res.json(await cinema.filmes({
      busca: req.query.busca || '',
      genero: req.query.genero || ''
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/filmes/:id', async (req, res, next) => {
  try {
    const filme = await cinema.filme(Number(req.params.id));
    if (!filme) return res.status(404).json({ erro: 'Filme não encontrado.' });
    res.json(filme);
  } catch (error) {
    next(error);
  }
});

router.get('/generos', async (_req, res, next) => {
  try {
    res.json(await cinema.generos());
  } catch (error) {
    next(error);
  }
});

router.get('/sessoes/:id/assentos', async (req, res, next) => {
  try {
    res.json(await cinema.assentos(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.get('/filmes/:id/sessoes', async (req, res, next) => {
  try {
    res.json(await cinema.sessoes(Number(req.params.id), {
      data: req.query.data || '',
      shopping: req.query.shopping || ''
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/contas', async (req, res, next) => {
  try {
    res.status(201).json(await cinema.criarConta(req.body));
  } catch (error) {
    next(error);
  }
});

router.post('/contas/verificar', async (req, res, next) => {
  try {
    res.json(await cinema.verificar(req.body.token));
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    res.json(await cinema.login(req.body));
  } catch (error) {
    next(error);
  }
});

router.get('/me', auth, (req, res) => res.json(req.user));

router.get('/me/pedidos', auth, async (req, res, next) => {
  try {
    res.json(await cinema.pedidos(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.post('/compras', auth, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!['inteira', 'meia', 'plano'].includes(body.tipo)) {
      return res.status(400).json({ erro: 'Tipo de ingresso inválido.' });
    }
    if (!Number.isInteger(Number(body.sessaoId))) {
      return res.status(400).json({ erro: 'Sessão inválida.' });
    }
    if (!Array.isArray(body.assentoIds) || body.assentoIds.length === 0) {
      return res.status(400).json({ erro: 'Selecione pelo menos um assento.' });
    }

    res.status(201).json(await cinema.comprar({
      usuarioId: req.user.id,
      sessaoId: Number(body.sessaoId),
      tipo: body.tipo,
      assentoIds: body.assentoIds,
      comboQuantidade: body.comboQuantidade
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/pedidos/:id/cancelar', auth, async (req, res, next) => {
  try {
    res.json(await cinema.cancelar(req.user.id, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

router.post('/pedidos/:id/reembolso', auth, async (req, res, next) => {
  try {
    res.json(await cinema.reembolso(req.user.id, Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
