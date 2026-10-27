// Envia as notificações da Lista de Mercado by Mascarelo (Firebase Cloud Messaging).
// Mesmo esquema do Bolão F1: roda no GitHub Actions com a conta de serviço do Firebase.
//
// Uso: node avisos/enviar.js                      -> rotina normal (avisa listas recém-criadas e recém-concluídas)
//      node avisos/enviar.js teste todos          -> notificação de teste para todos os aparelhos ativados
//      node avisos/enviar.js teste thiago,rafael  -> teste só para os aparelhos desses usuários
//      MENSAGEM="texto" node avisos/enviar.js teste todos   -> teste com texto próprio
// Variáveis: GOOGLE_APPLICATION_CREDENTIALS (chave) | SIMULAR=1 (não envia, só mostra)
const fs = require('fs');

const SITE = 'https://mascarelo.github.io/lista-mercado-mascarelo/';
const ICONE = SITE + 'icons/mercado-192.png';
// Lista criada/concluída há mais tempo que isso e ainda sem aviso (ex.: robô parado) é só marcada, sem notificar.
const MAX_ATRASO = 6 * 36e5;
// Listas criadas antes do aviso de "nova lista" existir não disparam esse aviso (27/10/2026, 05:30 em Brasília).
const CRIADA_DESDE = Date.parse('2026-10-27T08:30:00Z');

const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const ms = (t) => { const v = t && typeof t.toMillis === 'function' ? t.toMillis() : t ? +new Date(t) : 0; return Number.isFinite(v) ? v : 0; };

function textoConcluida(l) {
  const ok = l.boughtCount || 0, nao = l.notBoughtCount || 0;
  const quem = l.closedBy || 'Alguém';
  const resumo = nao === 0
    ? (ok === 1 ? 'o item foi comprado' : ok === 0 ? 'a lista estava vazia' : 'todos os ' + ok + ' itens foram comprados')
    : plural(ok, 'comprado', 'comprados') + ', ' + plural(nao, 'não comprado', 'não comprados');
  return {
    title: '🛒 Lista concluída: ' + (l.name || 'sem nome'),
    body: quem + ' concluiu a lista: ' + resumo + '. Toque para conferir os itens.'
  };
}

// Quem pode ver a lista: pública (ou antiga, sem o campo) = todos; senão só quem está em "acesso"
const podeVer = (l, uid) => l.publica !== false || !!(l.acesso && l.acesso[uid] === true);

function textoCriada(l) {
  return {
    title: '📝 Nova lista: ' + (l.name || 'sem nome'),
    body: (l.createdBy || 'Alguém') + ' criou uma lista. Entre e inclua os itens que você precisa.'
  };
}

// Aparelhos com notificação ligada para esse tipo de aviso ("concluida" ou "nova"), cujo dono ainda tem acesso ao app.
// Aparelho sem a preferência gravada recebe (ex.: quem ativou antes do aviso de nova lista existir).
async function aparelhosAtivos(db, tipo) {
  const [devs, users] = await Promise.all([db.collection('dispositivos').get(), db.collection('users').get()]);
  const ativos = new Map(users.docs.map((u) => [u.id, u.data()]));
  return devs.docs.map((d) => d.data())
    .filter((d) => d.token && ativos.has(d.uid) && (!tipo || !d.prefs || d.prefs[tipo] !== false))
    .map((d) => ({ ...d, username: (ativos.get(d.uid) || {}).username }));
}

// Lê a chave da conta de serviço. Aceita a chave colada com quebras de linha de verdade dentro de "private_key"
// (acontece ao copiar o .json por alguns editores), que o JSON normal recusaria com "Bad control character".
function lerChave(texto) {
  const t = String(texto || '').replace(/^﻿/, '').trim();
  if (!t) throw new Error('O segredo FIREBASE_SERVICE_ACCOUNT está vazio ou não existe no GitHub (Settings → Secrets and variables → Actions).');
  try { return JSON.parse(t); } catch (e1) {
    // troca quebras de linha (e outros caracteres de controle) que estejam DENTRO de textos entre aspas por \n
    let fora = true, out = '';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === '"' && t[i - 1] !== '\\') fora = !fora;
      if (!fora && (c === '\n' || c === '\r')) { if (c === '\n') out += '\\n'; continue; }
      if (!fora && c < ' ') continue;
      out += c;
    }
    try { return JSON.parse(out); } catch (e2) {
      throw new Error('O segredo FIREBASE_SERVICE_ACCOUNT não é um JSON válido (' + e1.message + '). Cole de novo o conteúdo inteiro do arquivo .json, do { até o }.');
    }
  }
}

// Manda para uma lista de aparelhos e apaga os registros de aparelhos que não existem mais
function criarEnviar({ db, messaging, simular, log, saida }) {
  return async function enviar(tokens, msg, link, descricao) {
    if (!tokens.length) { log('Ninguém com notificação ativada para: ' + descricao); return; }
    saida.push({ para: tokens.length, ...msg, descricao });
    log('ENVIO: ' + msg.title + ' | ' + msg.body + ' -> ' + tokens.length + ' aparelho(s) [' + descricao + ']');
    if (simular) return;
    for (let i = 0; i < tokens.length; i += 500) {
      const lote = tokens.slice(i, i + 500);
      const r = await messaging.sendEachForMulticast({
        tokens: lote,
        notification: { title: msg.title, body: msg.body },
        data: { url: link, tag: descricao },
        webpush: { fcmOptions: { link }, notification: { icon: ICONE } },     // site e app instalado pelo navegador
        android: { priority: 'high' }                                         // app Android (APK)
      });
      log('  ' + r.successCount + ' ok, ' + r.failureCount + ' com erro');
      await Promise.all(r.responses.map(async (x, j) => {
        const c = x.error && x.error.code;
        if (c) log('  erro: ' + c);
        if (c === 'messaging/registration-token-not-registered' || c === 'messaging/invalid-registration-token') {
          await db.doc('dispositivos/' + lote[j]).delete().catch(() => {});
        }
      }));
    }
  };
}

// Marca a lista como avisada de forma atômica (o vigia e o robô de 10 min nunca mandam o mesmo aviso duas vezes).
// tipo: "criada" ou "concluida". Devolve 'enviar', 'antiga' (só marcou, sem aviso) ou null (já tinha sido tratada).
async function reservar(db, ref, agora, tipo = 'concluida') {
  const campo = tipo === 'criada' ? 'avisoCriadaEm' : 'avisoConcluidaEm';
  return db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists) return null;
    const l = d.data();
    if (l[campo]) return null;
    let antiga;
    if (tipo === 'criada') {
      const t = ms(l.createdAt);
      // lista antiga, de antes deste aviso existir, ou que já foi concluída: só marca
      antiga = t < CRIADA_DESDE || agora - t > MAX_ATRASO || l.status === 'closed';
    } else {
      if (l.status !== 'closed') return null;
      antiga = agora - ms(l.closedAt) > MAX_ATRASO;
    }
    tx.update(ref, { [campo]: new Date(agora).toISOString(), [campo.replace('Em', 'Status')]: antiga ? 'antiga, sem aviso' : 'enviado' });
    return antiga ? 'antiga' : 'enviar';
  });
}

async function rodar({ db, messaging, agora = Date.now(), simular = false, log = console.log }) {
  const saida = [];
  const enviar = criarEnviar({ db, messaging, simular, log, saida });
  const listas = (await db.collection('lists').get()).docs;
  // Listas de antes da opção "quem pode ver" passam a valer para todos (feito uma vez só, pelo robô)
  for (const d of listas) {
    if (d.data().publica === undefined) {
      if (!simular) await d.ref.update({ publica: true, acesso: {}, visibilidade: 'todos' });
      log('Lista marcada como visível para todos: ' + d.data().name);
    }
  }
  const pendCriada = listas.filter((d) => !d.data().avisoCriadaEm);
  const pendConcluida = listas.filter((d) => d.data().status === 'closed' && !d.data().avisoConcluidaEm);
  if (!pendCriada.length && !pendConcluida.length) { log('Nenhuma lista nova criada ou concluída.'); return saida; }
  const devs = {};
  // aparelhos com o aviso ligado E cujo dono pode ver a lista
  const tokens = async (tipo, l) => {
    devs[tipo] = devs[tipo] || (await aparelhosAtivos(db, tipo));
    return devs[tipo].filter((x) => podeVer(l, x.uid)).map((x) => x.token);
  };
  // primeiro os avisos de lista criada, depois os de concluída (se as duas coisas aconteceram, chegam nessa ordem)
  for (const d of pendCriada) {
    const r = await reservar(db, d.ref, agora, 'criada');
    if (!r) continue;
    const l = d.data();
    if (r === 'antiga') { log('Lista sem aviso de criação (antiga ou já concluída): ' + l.name); continue; }
    await enviar(await tokens('nova', l), textoCriada(l), SITE + '#/lista/' + d.id, 'criada_' + d.id);
  }
  for (const d of pendConcluida) {
    const r = await reservar(db, d.ref, agora, 'concluida');
    if (!r) continue;
    const l = d.data();
    if (r === 'antiga') { log('Lista antiga, só marcada (sem aviso): ' + l.name); continue; }
    await enviar(await tokens('concluida', l), textoConcluida(l), SITE + '#/historico/' + d.id, 'concluida_' + d.id);
  }
  return saida;
}

// Notificação de teste. alvo: "todos" ou usuários separados por vírgula (thiago,rafael).
async function teste({ db, messaging, simular, alvo, mensagem, log = console.log }) {
  const lista = String(alvo || 'todos').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const todos = lista.includes('todos');
  const devs = (await aparelhosAtivos(db)).filter((d) => todos || lista.includes(d.username));
  const msg = (mensagem || '').trim()
    ? { title: '🛒 Lista de Mercado', body: mensagem.trim() }
    : { title: '🔔 Teste da Lista de Mercado', body: 'Se você está lendo isto, as notificações funcionam neste aparelho.' };
  log('Destino: ' + lista.join(', ') + ' | aparelhos encontrados: ' + devs.length);
  const saida = [];
  await criarEnviar({ db, messaging, simular, log, saida })(devs.map((d) => d.token), msg, SITE, 'teste');
  return saida;
}

async function main() {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getMessaging } = require('firebase-admin/messaging');
  initializeApp({ credential: cert(lerChave(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  const db = getFirestore(), messaging = getMessaging();
  const simular = !!process.env.SIMULAR;
  if (process.argv[2] === 'teste') return teste({ db, messaging, simular, alvo: process.argv[3], mensagem: process.env.MENSAGEM });
  await rodar({ db, messaging, simular });
}

module.exports = { rodar, teste, podeVer, textoConcluida, textoCriada, reservar, aparelhosAtivos, criarEnviar, lerChave };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error('ERRO', e.message); process.exit(1); });
