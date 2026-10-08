const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

const APP = process.env.APP_URL || 'http://localhost:5173';
const verificationTokens = new Map();
const sessionTokens = new Map();
let schemaCache = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function quoteId(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

async function getSchema() {
  if (schemaCache) return schemaCache;

  const [rows] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()`
  );

  const tables = {};
  for (const row of rows) {
    const t = String(row.TABLE_NAME);
    const c = String(row.COLUMN_NAME);
    (tables[t] ||= []).push(c);
  }

  const findTable = (...names) => names.find(n => tables[n]);
  const findColumn = (table, ...names) => {
    if (!table || !tables[table]) return null;
    const cols = tables[table];
    return names.find(n => cols.includes(n)) || null;
  };

  const filmes = findTable('filmes');
  const usuarios = findTable('usuarios');
  const sessoes = findTable('sessoes_cinema', 'sessoes');
  const assentos = findTable('assentos_cinema', 'assentos');
  const reservas = findTable('reservas_cinema', 'pedidos');
  const reservaAssentos = findTable('reserva_assentos_cinema', 'pedido_assentos');

  schemaCache = {
    tables,
    filmes: filmes && {
      table: filmes,
      id: findColumn(filmes, 'id_filme', 'id'),
      titulo: findColumn(filmes, 'titulo', 'nome'),
      genero: findColumn(filmes, 'genero', 'generos'),
      duracao: findColumn(filmes, 'duracao', 'duracao_minutos'),
      classificacao: findColumn(filmes, 'classificacao', 'classificacao_indicativa'),
      nota: findColumn(filmes, 'nota', 'avaliacao', 'nota_media'),
      sinopse: findColumn(filmes, 'sinopse', 'descricao'),
      ano: findColumn(filmes, 'ano', 'ano_lancamento'),
      destaque: findColumn(filmes, 'destaque', 'em_destaque'),
      atualizado: findColumn(filmes, 'atualizado_em', 'updated_at')
    },
    usuarios: usuarios && {
      table: usuarios,
      id: findColumn(usuarios, 'id_usuario', 'id'),
      nome: findColumn(usuarios, 'nome', 'name'),
      email: findColumn(usuarios, 'email'),
      senha: findColumn(usuarios, 'senha', 'senha_hash', 'password')
    },
    sessoes: sessoes && {
      table: sessoes,
      id: findColumn(sessoes, 'id_sessao', 'id_sessao_cinema', 'sessao_id', 'id'),
      filmeId: findColumn(sessoes, 'id_filme', 'filme_id', 'id_filmes', 'filme'),
      data: findColumn(sessoes, 'data_sessao', 'data', 'data_hora', 'data_inicio', 'dia'),
      horario: findColumn(sessoes, 'horario', 'hora', 'hora_sessao', 'horario_sessao'),
      shopping: findColumn(sessoes, 'shopping', 'cinema', 'local', 'shopping_cinema'),
      sala: findColumn(sessoes, 'sala', 'sala_numero', 'numero_sala'),
      formato: findColumn(sessoes, 'formato', 'tipo', 'tipo_sessao'),
      preco: findColumn(sessoes, 'preco_base', 'preco', 'valor', 'valor_ingresso')
    },
    assentos: assentos && {
      table: assentos,
      id: findColumn(assentos, 'id_assento', 'id'),
      sessaoId: findColumn(assentos, 'id_sessao', 'sessao_id'),
      codigo: findColumn(assentos, 'codigo', 'numero', 'assento'),
      status: findColumn(assentos, 'status', 'situacao', 'estado')
    },
    reservas: reservas && {
      table: reservas,
      id: findColumn(reservas, 'id_reserva', 'id'),
      usuarioId: findColumn(reservas, 'id_usuario', 'usuario_id'),
      sessaoId: findColumn(reservas, 'id_sessao', 'sessao_id'),
      shopping: findColumn(reservas, 'shopping', 'cinema', 'local'),
      tipo: findColumn(reservas, 'tipo_ingresso', 'tipo'),
      precoIngresso: findColumn(reservas, 'preco_ingresso', 'preco'),
      subtotalIngressos: findColumn(reservas, 'subtotal_ingressos'),
      subtotalCombo: findColumn(reservas, 'subtotal_combo'),
      total: findColumn(reservas, 'total', 'valor_total'),
      comboNome: findColumn(reservas, 'combo_nome'),
      comboQuantidade: findColumn(reservas, 'combo_quantidade'),
      clienteNome: findColumn(reservas, 'cliente_nome'),
      clienteEmail: findColumn(reservas, 'cliente_email'),
      status: findColumn(reservas, 'status'),
      criadoEm: findColumn(reservas, 'criado_em', 'data_criacao'),
      canceladoEm: findColumn(reservas, 'cancelado_em'),
      reembolsoEm: findColumn(reservas, 'reembolso_em')
    },
    reservaAssentos: reservaAssentos && {
      table: reservaAssentos,
      reservaId: findColumn(reservaAssentos, 'id_reserva', 'reserva_id', 'pedido_id'),
      assentoId: findColumn(reservaAssentos, 'id_assento', 'assento_id')
    }
  };

  return schemaCache;
}

function requireMap(map, names) {
  for (const name of names) {
    if (name) return name;
  }
  return null;
}

function mailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' }
      : undefined
  });
}

async function sendMail(to, subject, html) {
  const t = mailer();
  if (!t) return { demo: true };
  await t.sendMail({
    from: process.env.MAIL_FROM || 'Cinemasso <no-reply@cinemasso.local>',
    to,
    subject,
    html
  });
  return { demo: false };
}

function money(n) {
  return Number(n || 0);
}

class Cinema {
  async filmes({ busca = '', genero = '' } = {}) {
    const s = await getSchema();
    if (!s.filmes || !s.filmes.id || !s.filmes.titulo) return [];

    const f = s.filmes;
    const w = [];
    const p = [];

    if (busca) {
      const searchCols = [f.titulo, f.genero].filter(Boolean);
      if (searchCols.length) {
        w.push(`(${searchCols.map(c => `${quoteId(c)} LIKE ?`).join(' OR ')})`);
        p.push(...searchCols.map(() => `%${busca}%`));
      }
    }
    if (genero && genero !== 'Todos' && f.genero) {
      w.push(`${quoteId(f.genero)} LIKE ?`);
      p.push(`%${genero}%`);
    }

    const order = f.titulo
      ? `ORDER BY ${f.destaque ? `${quoteId(f.destaque)} DESC, ` : ''}${f.atualizado ? `${quoteId(f.atualizado)} DESC, ` : ''}${quoteId(f.titulo)}`
      : '';

    const [rows] = await pool.query(
      `SELECT * FROM ${quoteId(f.table)} ${w.length ? `WHERE ${w.join(' AND ')}` : ''} ${order}`,
      p
    );

    return rows
      .filter(x => String(x[f.titulo] || '').trim().toLowerCase() !== 'super mario galaxy o filme')
      .map(x => this.normalizeMovie(x, f));
  }

  normalizeMovie(row, f) {
    return {
      ...row,
      id: row[f.id],
      titulo: row[f.titulo],
      genero: f.genero ? row[f.genero] : '',
      duracao: f.duracao ? row[f.duracao] : 0,
      classificacao: f.classificacao ? row[f.classificacao] : '',
      nota: f.nota ? row[f.nota] : 0,
      sinopse: f.sinopse ? row[f.sinopse] : '',
      ano: f.ano ? row[f.ano] : ''
    };
  }

  async filme(id) {
    const s = await getSchema();
    if (!s.filmes?.id) return null;
    const f = s.filmes;
    const [r] = await pool.query(
      `SELECT * FROM ${quoteId(f.table)} WHERE ${quoteId(f.id)}=? LIMIT 1`,
      [id]
    );
    if (!r.length) return null;
    if (String(f.titulo && r[0][f.titulo] || '').trim().toLowerCase() === 'super mario galaxy o filme') return null;
    return this.normalizeMovie(r[0], f);
  }

  async generos() {
    const s = await getSchema();
    if (!s.filmes?.genero) return [];
    const [r] = await pool.query(
      `SELECT DISTINCT ${quoteId(s.filmes.genero)} AS genero
         FROM ${quoteId(s.filmes.table)}
        WHERE ${quoteId(s.filmes.genero)} IS NOT NULL
          AND ${quoteId(s.filmes.genero)} <> ''
        ORDER BY ${quoteId(s.filmes.genero)}`
    );
    return r.map(x => x.genero).filter(Boolean);
  }

  async sessoes(filmeId, { data = '', shopping = '' } = {}) {
    const s = await getSchema();
    if (!s.sessoes?.id || !s.sessoes.filmeId) return [];

    const x = s.sessoes;
    const f = s.filmes;
    const w = [`s.${quoteId(x.filmeId)}=?`];
    const p = [filmeId];

    if (x.data && data) {
      w.push(`DATE(s.${quoteId(x.data)})=?`);
      p.push(data);
    }
    if (x.shopping && shopping) {
      w.push(`s.${quoteId(x.shopping)}=?`);
      p.push(shopping);
    }
    const selectMovie = f?.titulo
      ? `, f.${quoteId(f.titulo)} AS titulo${f.classificacao ? `, f.${quoteId(f.classificacao)} AS classificacao` : ''}${f.nota ? `, f.${quoteId(f.nota)} AS nota` : ''}`
      : '';

    const join = f?.id ? ` LEFT JOIN ${quoteId(f.table)} f ON f.${quoteId(f.id)}=s.${quoteId(x.filmeId)}` : '';
    const [rows] = await pool.query(
      `SELECT s.*${selectMovie}
         FROM ${quoteId(x.table)} s${join}
        WHERE ${w.join(' AND ')}
        ORDER BY ${x.data ? `s.${quoteId(x.data)}, ` : ''}${x.horario ? `s.${quoteId(x.horario)}` : `s.${quoteId(x.id)}`}`,
      p
    );

    return rows.map(r => {
      let rawDate = x.data ? r[x.data] : '';
      let rawTime = x.horario ? r[x.horario] : '';
      if (rawDate instanceof Date) {
        const iso = rawDate.toISOString();
        rawDate = iso.slice(0, 10);
        if (!x.horario) rawTime = iso.slice(11, 19);
      } else {
        const text = String(rawDate || '').trim();
        if (/^\d{4}-\d{2}-\d{2}[T ]/.test(text)) {
          if (!x.horario) rawTime = text.slice(11, 19);
          rawDate = text.slice(0, 10);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) {
          const [d, m, y] = text.slice(0, 10).split('/');
          rawDate = `${y}-${m}-${d}`;
          if (!x.horario) rawTime = text.slice(11, 19);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
          rawDate = text;
        } else {
          rawDate = text.slice(0, 10);
        }
      }
      return {
        ...r,
        id: r[x.id],
        filme_id: r[x.filmeId],
        data_sessao: rawDate,
        horario: rawTime,
        shopping: x.shopping ? r[x.shopping] : '',
        sala: x.sala ? r[x.sala] : '',
        formato: x.formato ? r[x.formato] : '',
        preco_base: x.preco ? r[x.preco] : 0
      };
    });
  }

  async assentos(sessaoId) {
    const s = await getSchema();
    if (!s.assentos?.id || !s.assentos.sessaoId) return [];

    const a = s.assentos;
    const [rows] = await pool.query(
      `SELECT * FROM ${quoteId(a.table)}
        WHERE ${quoteId(a.sessaoId)}=?
        ORDER BY ${a.codigo ? quoteId(a.codigo) : quoteId(a.id)}`,
      [sessaoId]
    );

    return rows.map(r => ({
      ...r,
      id: r[a.id],
      codigo: a.codigo ? r[a.codigo] : String(r[a.id]),
      status: a.status ? String(r[a.status] || 'livre').toLowerCase() : 'livre'
    }));
  }

  async criarConta({ nome, email, senha } = {}) {
    const s = await getSchema();
    if (!s.usuarios?.id || !s.usuarios.nome || !s.usuarios.email || !s.usuarios.senha) {
      throw Object.assign(new Error('A tabela usuarios não possui as colunas necessárias para cadastro.'), { status: 500 });
    }

    nome = String(nome || '').trim();
    email = String(email || '').trim().toLowerCase();
    senha = String(senha || '');

    if (!nome || nome.length < 2) throw Object.assign(new Error('Informe seu nome.'), { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) throw Object.assign(new Error('E-mail inválido.'), { status: 400 });
    if (senha.length < 6) throw Object.assign(new Error('A senha deve ter pelo menos 6 caracteres.'), { status: 400 });

    const [exists] = await pool.query(
      `SELECT ${quoteId(s.usuarios.id)} FROM ${quoteId(s.usuarios.table)} WHERE ${quoteId(s.usuarios.email)}=? LIMIT 1`,
      [email]
    );
    if (exists.length) throw Object.assign(new Error('Este e-mail já está cadastrado.'), { status: 409 });

    const hash = await bcrypt.hash(senha, 12);
    const [result] = await pool.query(
      `INSERT INTO ${quoteId(s.usuarios.table)} (${quoteId(s.usuarios.nome)},${quoteId(s.usuarios.email)},${quoteId(s.usuarios.senha)}) VALUES (?,?,?)`,
      [nome, email, hash]
    );

    const usuarioId = result.insertId;

    // Sem SMTP, o modo local confirma automaticamente para evitar dependência de
    // tabela extra no banco. Com SMTP, o token fica apenas em memória durante o
    // desenvolvimento e o link é enviado por e-mail.
    if (!process.env.SMTP_HOST) {
      return {
        mensagem: 'Conta criada com sucesso. O modo local confirmou sua conta automaticamente.',
        email,
        devConfirmUrl: undefined
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    verificationTokens.set(token, {
      usuarioId,
      expires: Date.now() + 24 * 60 * 60 * 1000
    });

    const url = `${APP}/?verificar=${encodeURIComponent(token)}`;
    await sendMail(
      email,
      'Confirme sua conta no Cinemasso',
      `<h2>Bem-vindo ao Cinemasso, ${nome}!</h2><p><a href="${url}">Confirmar minha conta</a></p><p>O link expira em 24 horas.</p>`
    );

    return { mensagem: 'Conta criada. Verifique seu e-mail para ativar o acesso.', email };
  }

  async verificar(token) {
    const item = verificationTokens.get(String(token || ''));
    if (!item || item.expires < Date.now()) {
      verificationTokens.delete(String(token || ''));
      throw Object.assign(new Error('Link de confirmação inválido ou expirado.'), { status: 400 });
    }
    verificationTokens.delete(String(token || ''));
    return { id: item.usuarioId };
  }

  async login({ email, senha } = {}) {
    const s = await getSchema();
    if (!s.usuarios?.id || !s.usuarios.email || !s.usuarios.senha || !s.usuarios.nome) {
      throw Object.assign(new Error('A tabela usuarios não possui as colunas necessárias para login.'), { status: 500 });
    }

    email = String(email || '').trim().toLowerCase();
    senha = String(senha || '');

    const [r] = await pool.query(
      `SELECT ${quoteId(s.usuarios.id)} AS id_usuario,
              ${quoteId(s.usuarios.nome)} AS nome,
              ${quoteId(s.usuarios.email)} AS email,
              ${quoteId(s.usuarios.senha)} AS senha
         FROM ${quoteId(s.usuarios.table)}
        WHERE ${quoteId(s.usuarios.email)}=?
        LIMIT 1`,
      [email]
    );

    if (!r.length || !(await bcrypt.compare(senha, r[0].senha))) {
      throw Object.assign(new Error('E-mail ou senha incorretos.'), { status: 401 });
    }

    const raw = crypto.randomBytes(32).toString('hex');
    sessionTokens.set(raw, {
      usuarioId: r[0].id_usuario,
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    return {
      token: raw,
      usuario: { id: r[0].id_usuario, nome: r[0].nome, email: r[0].email }
    };
  }

  async usuario(token) {
    if (!token) return null;
    const item = sessionTokens.get(token);
    if (!item || item.expires < Date.now()) {
      sessionTokens.delete(token);
      return null;
    }
    const s = await getSchema();
    if (!s.usuarios?.id) return null;
    const [r] = await pool.query(
      `SELECT ${quoteId(s.usuarios.id)} AS id,
              ${quoteId(s.usuarios.nome)} AS nome,
              ${quoteId(s.usuarios.email)} AS email
         FROM ${quoteId(s.usuarios.table)}
        WHERE ${quoteId(s.usuarios.id)}=? LIMIT 1`,
      [item.usuarioId]
    );
    return r[0] || null;
  }

  async pedidos(usuarioId) {
    const s = await getSchema();
    if (!s.reservas?.id || !s.reservas.usuarioId) return [];

    const rsv = s.reservas;
    const ses = s.sessoes;
    const f = s.filmes;

    if (!ses?.id || !rsv.sessaoId || !f?.id || !ses.filmeId) return [];

    const select = [
      `r.${quoteId(rsv.id)} AS id`,
      rsv.status ? `r.${quoteId(rsv.status)} AS status` : `'confirmado' AS status`,
      rsv.tipo ? `r.${quoteId(rsv.tipo)} AS tipo_ingresso` : `'' AS tipo_ingresso`,
      rsv.total ? `r.${quoteId(rsv.total)} AS total` : `0 AS total`,
      rsv.comboQuantidade ? `r.${quoteId(rsv.comboQuantidade)} AS combo_quantidade` : `0 AS combo_quantidade`,
      ses.data ? `s.${quoteId(ses.data)} AS data_sessao` : `NULL AS data_sessao`,
      ses.horario ? `s.${quoteId(ses.horario)} AS horario` : `NULL AS horario`,
      ses.sala ? `s.${quoteId(ses.sala)} AS sala` : `'' AS sala`,
      ses.formato ? `s.${quoteId(ses.formato)} AS formato` : `'' AS formato`,
      f.titulo ? `f.${quoteId(f.titulo)} AS titulo` : `'' AS titulo`,
      ses.shopping ? `s.${quoteId(ses.shopping)} AS shopping` : `'' AS shopping`
    ];

    const [rows] = await pool.query(
      `SELECT ${select.join(', ')}
         FROM ${quoteId(rsv.table)} r
         JOIN ${quoteId(ses.table)} s ON s.${quoteId(ses.id)}=r.${quoteId(rsv.sessaoId)}
         JOIN ${quoteId(f.table)} f ON f.${quoteId(f.id)}=s.${quoteId(ses.filmeId)}
        WHERE r.${quoteId(rsv.usuarioId)}=?
        ORDER BY ${rsv.criadoEm ? `r.${quoteId(rsv.criadoEm)} DESC` : `r.${quoteId(rsv.id)} DESC`}`,
      [usuarioId]
    );

    if (s.reservaAssentos?.reservaId && s.reservaAssentos?.assentoId && s.assentos?.id && s.assentos.codigo) {
      for (const x of rows) {
        const [a] = await pool.query(
          `SELECT a.${quoteId(s.assentos.codigo)} AS codigo
             FROM ${quoteId(s.reservaAssentos.table)} ra
             JOIN ${quoteId(s.assentos.table)} a ON a.${quoteId(s.assentos.id)}=ra.${quoteId(s.reservaAssentos.assentoId)}
            WHERE ra.${quoteId(s.reservaAssentos.reservaId)}=?
            ORDER BY a.${quoteId(s.assentos.codigo)}`,
          [x.id]
        );
        x.assentos = a.map(v => v.codigo);
      }
    } else {
      for (const x of rows) x.assentos = [];
    }

    return rows;
  }

  price(base, tipo, formato) {
    let v = money(base);
    if (tipo === 'meia') v *= 0.5;
    if (tipo === 'plano') v *= 0.8;
    if (formato === '3D') v += 5;
    return Number(v.toFixed(2));
  }

  async comprar({ usuarioId, sessaoId, tipo, assentoIds, comboQuantidade = 0 }) {
    const s = await getSchema();
    if (!s.sessoes?.id || !s.assentos?.id || !s.assentos.sessaoId || !s.reservas?.id || !s.reservas.usuarioId || !s.reservas.sessaoId) {
      throw Object.assign(new Error('A estrutura de sessões, assentos ou reservas do banco ainda não está compatível com o Cinemasso.'), { status: 503 });
    }

    const ids = [...new Set((Array.isArray(assentoIds) ? assentoIds : [])
      .map(Number).filter(Number.isInteger))];
    if (!ids.length) throw Object.assign(new Error('Selecione pelo menos um assento.'), { status: 400 });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const ses = s.sessoes;
      const f = s.filmes;
      const a = s.assentos;
      const r = s.reservas;

      const selectSession = `SELECT s.*${f?.titulo ? `, f.${quoteId(f.titulo)} AS titulo` : ''}
        FROM ${quoteId(ses.table)} s
        ${f?.id && ses.filmeId ? `JOIN ${quoteId(f.table)} f ON f.${quoteId(f.id)}=s.${quoteId(ses.filmeId)}` : ''}
        WHERE s.${quoteId(ses.id)}=? FOR UPDATE`;
      const [sessionRows] = await conn.query(selectSession, [sessaoId]);
      if (!sessionRows.length) throw Object.assign(new Error('Sessão não encontrada.'), { status: 404 });

      const sr = sessionRows[0];
      const [seatRows] = await conn.query(
        `SELECT ${quoteId(a.id)} AS id, ${a.status ? quoteId(a.status) : 'NULL'} AS status
           FROM ${quoteId(a.table)}
          WHERE ${quoteId(a.sessaoId)}=?
            AND ${quoteId(a.id)} IN (${ids.map(() => '?').join(',')})
          FOR UPDATE`,
        [sessaoId, ...ids]
      );

      const normalized = seatRows.map(x => String(x.status || 'livre').toLowerCase());
      if (seatRows.length !== ids.length || normalized.some(v => !['livre', 'disponivel', 'disponível'].includes(v))) {
        throw Object.assign(new Error('Um ou mais assentos não estão disponíveis.'), { status: 409 });
      }

      const u = s.usuarios;
      const [users] = await conn.query(
        `SELECT ${quoteId(u.nome)} AS nome, ${quoteId(u.email)} AS email
           FROM ${quoteId(u.table)}
          WHERE ${quoteId(u.id)}=? LIMIT 1`,
        [usuarioId]
      );
      if (!users.length) throw Object.assign(new Error('Usuário não encontrado.'), { status: 401 });

      const precoBase = ses.preco ? sr[ses.preco] : 0;
      const formato = ses.formato ? sr[ses.formato] : '';
      const preco = this.price(precoBase, tipo, formato);
      const ingressos = preco * ids.length;
      const combo = Math.max(0, Number(comboQuantidade) || 0) * 24.9;
      const total = Number((ingressos + combo).toFixed(2));

      const values = [];
      const columns = [];
      const add = (col, value) => { if (col) { columns.push(quoteId(col)); values.push(value); } };

      add(r.usuarioId, usuarioId);
      add(r.sessaoId, sessaoId);
      add(r.shopping && ses.shopping ? r.shopping : null, ses.shopping ? sr[ses.shopping] : '');
      add(r.tipo, tipo);
      add(r.precoIngresso, preco);
      add(r.subtotalIngressos, ingressos);
      add(r.subtotalCombo, combo);
      add(r.total, total);
      add(r.comboNome, combo ? 'Combo Pipoca + Refrigerante' : '');
      add(r.comboQuantidade, Number(comboQuantidade) || 0);
      add(r.clienteNome, users[0].nome);
      add(r.clienteEmail, users[0].email);
      add(r.status, 'confirmado');

      if (!columns.length) throw Object.assign(new Error('A tabela de reservas não possui colunas compatíveis.'), { status: 503 });

      const [insert] = await conn.query(
        `INSERT INTO ${quoteId(r.table)} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
        values
      );
      const reservaId = insert.insertId;

      if (s.reservaAssentos?.reservaId && s.reservaAssentos?.assentoId) {
        await conn.query(
          `INSERT INTO ${quoteId(s.reservaAssentos.table)} (${quoteId(s.reservaAssentos.reservaId)},${quoteId(s.reservaAssentos.assentoId)})
           VALUES ${ids.map(() => '(?,?)').join(',')}`,
          ids.flatMap(id => [reservaId, id])
        );
      }

      if (a.status) {
        await conn.query(
          `UPDATE ${quoteId(a.table)} SET ${quoteId(a.status)}='ocupado'
            WHERE ${quoteId(a.id)} IN (${ids.map(() => '?').join(',')})`,
          ids
        );
      }

      await conn.commit();

      await sendMail(
        users[0].email,
        'Seu ingresso Cinemasso está confirmado',
        `<h2>Compra confirmada!</h2><p>Pedido #${reservaId}${sr.titulo ? ` — ${sr.titulo}` : ''}</p><p>Total: R$ ${total.toFixed(2).replace('.', ',')}</p>`
      );

      return {
        pedidoId: reservaId,
        total,
        shopping: ses.shopping ? sr[ses.shopping] : '',
        filme: sr.titulo || '',
        assentos: ids
      };
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  }

  async cancelar(usuarioId, id) {
    const s = await getSchema();
    if (!s.reservas?.id || !s.reservas.usuarioId) throw Object.assign(new Error('Tabela de reservas não disponível.'), { status: 503 });

    const r = s.reservas;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT * FROM ${quoteId(r.table)}
          WHERE ${quoteId(r.id)}=? AND ${quoteId(r.usuarioId)}=? FOR UPDATE`,
        [id, usuarioId]
      );
      if (!rows.length) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });

      if (r.status && String(rows[0][r.status] || 'confirmado') !== 'confirmado') {
        throw Object.assign(new Error('Este pedido não pode mais ser cancelado.'), { status: 400 });
      }

      if (r.status && r.canceladoEm) {
        await conn.query(
          `UPDATE ${quoteId(r.table)} SET ${quoteId(r.status)}='cancelado',${quoteId(r.canceladoEm)}=NOW() WHERE ${quoteId(r.id)}=?`,
          [id]
        );
      } else if (r.status) {
        await conn.query(
          `UPDATE ${quoteId(r.table)} SET ${quoteId(r.status)}='cancelado' WHERE ${quoteId(r.id)}=?`,
          [id]
        );
      }

      if (s.reservaAssentos?.reservaId && s.reservaAssentos.assentoId && s.assentos?.id && s.assentos.status) {
        await conn.query(
          `UPDATE ${quoteId(s.assentos.table)} a
              JOIN ${quoteId(s.reservaAssentos.table)} ra
                ON ra.${quoteId(s.reservaAssentos.assentoId)}=a.${quoteId(s.assentos.id)}
             SET a.${quoteId(s.assentos.status)}='livre'
           WHERE ra.${quoteId(s.reservaAssentos.reservaId)}=?`,
          [id]
        );
      }

      await conn.commit();
      return { mensagem: 'Ingresso cancelado. Você pode solicitar o reembolso.' };
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  }

  async reembolso(usuarioId, id) {
    const s = await getSchema();
    if (!s.reservas?.id || !s.reservas.usuarioId || !s.reservas.status) {
      throw Object.assign(new Error('Tabela de reservas não disponível para reembolso.'), { status: 503 });
    }
    const r = s.reservas;
    const [rows] = await pool.query(
      `SELECT * FROM ${quoteId(r.table)} WHERE ${quoteId(r.id)}=? AND ${quoteId(r.usuarioId)}=?`,
      [id, usuarioId]
    );
    if (!rows.length) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });

    const status = String(rows[0][r.status] || '');
    if (!['cancelado', 'reembolso_solicitado'].includes(status)) {
      throw Object.assign(new Error('Cancele o pedido antes de solicitar o reembolso.'), { status: 400 });
    }

    if (r.reembolsoEm) {
      await pool.query(
        `UPDATE ${quoteId(r.table)} SET ${quoteId(r.status)}='reembolso_solicitado',${quoteId(r.reembolsoEm)}=NOW() WHERE ${quoteId(r.id)}=?`,
        [id]
      );
    } else {
      await pool.query(
        `UPDATE ${quoteId(r.table)} SET ${quoteId(r.status)}='reembolso_solicitado' WHERE ${quoteId(r.id)}=?`,
        [id]
      );
    }

    return { mensagem: 'Solicitação de reembolso registrada. O processamento financeiro deve ser feito pelo meio de pagamento utilizado.' };
  }
}

module.exports = { Cinema };
