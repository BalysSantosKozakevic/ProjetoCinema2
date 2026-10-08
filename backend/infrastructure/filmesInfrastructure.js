const crypto = require('crypto'), bcrypt = require('bcryptjs'), nodemailer = require('nodemailer'); const { pool } = require('../config/db');

const APP = process.env.APP_URL || 'http://localhost:5173';

const money = (n) => Number(n || 0);

function mailer() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined })
}

async function sendMail(to, subject, html) {
  const t = mailer();

  if (!t) {
    console.log(`[E-MAIL DEMO] Para ${to}: ${subject} -> ${html.match(/href="([^"]+)/)?.[1] || ''}`);

    return
  } await t.sendMail({ from: process.env.MAIL_FROM || 'Cinemasso <no-reply@cinemasso.local>', to, subject, html })
}

class Cinema {

  async filmes({ busca = '', genero = '' }) {
    let w = [], p = []; if (busca) {
      w.push('(titulo LIKE ? OR genero LIKE ?)');

      p.push(`%${busca}%`, `%${busca}%`)
    } if (genero && genero !== 'Todos') {
      w.push('genero=?');

      p.push(genero)
    } const [r] = await pool.query(`SELECT * FROM filmes ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY destaque DESC, atualizado_em DESC,titulo`, p);

    return r
  }

  async filme(id) {
    const [r] = await pool.query('SELECT * FROM filmes WHERE id=?', [id]);

    return r[0]
  }

  async generos() {
    const [r] = await pool.query('SELECT DISTINCT genero FROM filmes ORDER BY genero');

    return r.map(x => x.genero)
  }

  async sessoes(filmeId, { data = '', shopping = '' } = {}) {
    let w = ['s.filme_id=?', 's.data_sessao>=CURDATE()'], p = [filmeId];

    if (data) { w.push('s.data_sessao=?'); p.push(data) } if (shopping) {
      w.push('s.shopping=?');

      p.push(shopping)
    } const [r] = await pool.query(`SELECT s.*,f.titulo,f.classificacao,f.nota FROM sessoes s JOIN filmes f ON f.id=s.filme_id WHERE ${w.join(' AND ')} ORDER BY s.data_sessao,s.horario`, p);

    return r
  }

  async assentos(id) {
    const [r] = await pool.query('SELECT id,codigo,status FROM assentos WHERE sessao_id=? ORDER BY codigo', [id]);

    return r
  }

  async criarConta({ nome, email, senha } = {}) {
    nome = String(nome || '').trim();
    email = String(email || '').trim().toLowerCase();
    senha = String(senha || '');

    if (!nome || nome.length < 2) throw Object.assign(new Error('Informe seu nome.'), { status: 400 });

    if (!/^\S+@\S+\.\S+$/.test(email)) throw Object.assign(new Error('E-mail inválido.'), { status: 400 });

    if (!senha || senha.length < 6) throw Object.assign(new Error('A senha deve ter pelo menos 6 caracteres.'), { status: 400 });

    const [exists] = await pool.query('SELECT id FROM usuarios WHERE email=?', [email]); if (exists.length) throw Object.assign(new Error('Este e-mail já está cadastrado.'), { status: 409 });

    const hash = await bcrypt.hash(senha, 12), token = crypto.randomBytes(32).toString('hex'); await pool.query('INSERT INTO usuarios(nome,email,senha_hash,token_verificacao,token_expira) VALUES(?,?,?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))', [nome, email, hash, token]);

    const url = `${APP}/?verificar=${token}`; await sendMail(email, 'Confirme sua conta no Cinemasso', `<h2>Bem-vindo ao Cinemasso, ${nome}!</h2><p>Confirme sua conta clicando no botão:</p><p><a href="${url}">Confirmar minha conta</a></p><p>O link expira em 24 horas.</p>`);

    return { mensagem: 'Conta criada. Verifique seu e-mail para ativar o acesso.', email, devConfirmUrl: process.env.SMTP_HOST ? undefined : url }
  }

  async verificar(token) {
    const [r] = await pool.query('SELECT id,nome,email FROM usuarios WHERE token_verificacao=? AND token_expira>NOW()', [token]);

    if (!r.length) throw Object.assign(new Error('Link de confirmação inválido ou expirado.'), { status: 400 });

    await pool.query('UPDATE usuarios SET email_verificado=1,token_verificacao=NULL,token_expira=NULL WHERE id=?', [r[0].id]);

    return r[0]
  }

  async login({ email, senha } = {}) {
    email = String(email || '').trim().toLowerCase();
    senha = String(senha || '');
    const [r] = await pool.query('SELECT * FROM usuarios WHERE email=?', [email.trim().toLowerCase()]);

    if (!r.length || !(await bcrypt.compare(senha, r[0].senha_hash))) throw Object.assign(new Error('E-mail ou senha incorretos.'), { status: 401 });

    if (!r[0].email_verificado) throw Object.assign(new Error('Confirme seu e-mail antes de entrar.'), { status: 403 });

    const raw = crypto.randomBytes(32).toString('hex'), hash = crypto.createHash('sha256').update(raw).digest('hex');

    await pool.query('INSERT INTO sessoes_tokens(usuario_id,token_hash,expira_em) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 30 DAY))', [r[0].id, hash]);

    return { token: raw, usuario: { id: r[0].id, nome: r[0].nome, email: r[0].email } }
  }

  async usuario(token) {
    if (!token) return null;

    const h = crypto.createHash('sha256').update(token).digest('hex');

    const [r] = await pool.query('SELECT u.id,u.nome,u.email FROM sessoes_tokens t JOIN usuarios u ON u.id=t.usuario_id WHERE t.token_hash=? AND t.expira_em>NOW()', [h]);

    return r[0] || null
  }

  async pedidos(usuarioId) {
    const [r] = await pool.query(`SELECT p.*,f.titulo,s.data_sessao,s.horario,s.sala,s.formato FROM pedidos p JOIN sessoes s ON s.id=p.sessao_id JOIN filmes f ON f.id=s.filme_id WHERE p.usuario_id=? ORDER BY p.criado_em DESC`, [usuarioId]);

    for (const x of r) { const [a] = await pool.query('SELECT a.codigo FROM pedido_assentos pa JOIN assentos a ON a.id=pa.assento_id WHERE pa.pedido_id=? ORDER BY a.codigo', [x.id]); x.assentos = a.map(v => v.codigo) } return r
  }
  price(base, tipo, formato) { let v = money(base); if (tipo === 'meia') v *= .5; if (tipo === 'plano') v *= .8; if (formato === '3D') v += 5; return Number(v.toFixed(2)) }
  async comprar({ usuarioId, sessaoId, tipo, assentoIds, comboQuantidade = 0 }) {
    const idsInput = Array.isArray(assentoIds) ? assentoIds : [];
    const ids = [...new Set(idsInput.map(Number).filter(Number.isInteger))];
    if (!ids.length) throw Object.assign(new Error('Selecione pelo menos um assento.'), { status: 400 });
    const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [s] = await conn.query('SELECT s.*,f.titulo FROM sessoes s JOIN filmes f ON f.id=s.filme_id WHERE s.id=? FOR UPDATE', [sessaoId]); if (!s.length) throw Object.assign(new Error('Sessão não encontrada.'), { status: 404 }); const [a] = await conn.query(`SELECT id,status FROM assentos WHERE sessao_id=? AND id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, [sessaoId, ...ids]); if (a.length !== ids.length || a.some(x => x.status !== 'livre')) throw Object.assign(new Error('Um ou mais assentos não estão disponíveis.'), { status: 409 }); const [u] = await conn.query('SELECT id,nome,email FROM usuarios WHERE id=?', [usuarioId]); if (!u.length) throw Object.assign(new Error('Usuário não encontrado.'), { status: 401 }); const preco = this.price(s[0].preco_base, tipo, s[0].formato), ing = preco * ids.length, combo = Math.max(0, Number(comboQuantidade) || 0) * 24.9, total = Number((ing + combo).toFixed(2)); const [p] = await conn.query('INSERT INTO pedidos(usuario_id,sessao_id,shopping,tipo_ingresso,preco_ingresso,subtotal_ingressos,subtotal_combo,total,combo_nome,combo_quantidade,cliente_nome,cliente_email) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', [usuarioId, s[0].id, s[0].shopping, tipo, preco, ing, combo, total, combo ? 'Combo Pipoca + Refrigerante' : '', comboQuantidade, u[0].nome, u[0].email]); await conn.query(`INSERT INTO pedido_assentos(pedido_id,assento_id) VALUES ${ids.map(() => '(?,?)').join(',')}`, ids.flatMap(id => [p.insertId, id])); await conn.query(`UPDATE assentos SET status='ocupado' WHERE id IN (${ids.map(() => '?').join(',')})`, ids); await conn.commit(); await sendMail(u[0].email, 'Seu ingresso Cinemasso está confirmado', `<h2>Compra confirmada!</h2><p>Pedido #${p.insertId} — ${s[0].titulo}</p><p>${s[0].shopping} · ${new Date(s[0].data_sessao).toLocaleDateString('pt-BR')} às ${String(s[0].horario).slice(0, 5)}</p><p>Total: R$ ${total.toFixed(2).replace('.', ',')}</p>`); return { pedidoId: p.insertId, total, shopping: s[0].shopping, filme: s[0].titulo, assentos: ids } } catch (e) { await conn.rollback(); throw e } finally { conn.release() }
  }
  async cancelar(usuarioId, id) { const conn = await pool.getConnection(); try { await conn.beginTransaction(); const [p] = await conn.query('SELECT * FROM pedidos WHERE id=? AND usuario_id=? FOR UPDATE', [id, usuarioId]); if (!p.length) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 }); if (p[0].status !== 'confirmado') throw Object.assign(new Error('Este pedido não pode mais ser cancelado.'), { status: 400 }); await conn.query('UPDATE pedidos SET status="cancelado",cancelado_em=NOW() WHERE id=?', [id]); await conn.query('UPDATE assentos a JOIN pedido_assentos pa ON pa.assento_id=a.id SET a.status="livre" WHERE pa.pedido_id=?', [id]); await conn.commit(); return { mensagem: 'Ingresso cancelado. Você pode solicitar o reembolso.' } } catch (e) { await conn.rollback(); throw e } finally { conn.release() } }
  async reembolso(usuarioId, id) { const [p] = await pool.query('SELECT * FROM pedidos WHERE id=? AND usuario_id=?', [id, usuarioId]); if (!p.length) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 }); if (!['cancelado', 'reembolso_solicitado'].includes(p[0].status)) throw Object.assign(new Error('Cancele o pedido antes de solicitar o reembolso.'), { status: 400 }); await pool.query('UPDATE pedidos SET status="reembolso_solicitado",reembolso_em=NOW() WHERE id=?', [id]); return { mensagem: 'Solicitação de reembolso registrada. O processamento financeiro deve ser feito pelo meio de pagamento utilizado.' } }
}
module.exports = { Cinema };
