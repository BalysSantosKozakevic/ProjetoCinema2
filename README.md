# Cinemasso — compra de ingressos

Aplicação full-stack de cinema com catálogo, conta de usuário, confirmação de e-mail, login, sessões por shopping/data/horário, seleção de assentos, tipos de ingresso, combo, histórico, cancelamento e solicitação de reembolso.

## Rodar
1. `docker compose up -d mysql`
2. `cd backend && npm install && npm start`
3. Em outro terminal: `cd frontend && npm install && npm run dev`

## E-mail
Copie `backend/.env.example` para `backend/.env` e configure SMTP. Sem SMTP, o backend imprime no terminal o link de confirmação para desenvolvimento local.

## Preços
Os preços são parametrizados por sessão e usam como referência faixas atuais de redes brasileiras; o valor final pode variar por shopping, dia, formato e promoção. Antes de produção, conecte o catálogo/preçário real da rede.

## Pagamento
O checkout desta versão é simulado. Para cobrar de verdade, conecte um gateway de pagamento e implemente webhooks de confirmação/estorno.

## Funcionalidades
- Conta e confirmação por e-mail
- Login por e-mail e senha
- Catálogo por gênero e pesquisa
- Detalhes: sinopse, classificação e nota
- Shopping, data e horário
- Inteira, meia e plano
- Assentos
- Combo pipoca + refrigerante
- Histórico
- Cancelamento
- Solicitação de reembolso
- Navegação voltar/início e histórico do navegador
