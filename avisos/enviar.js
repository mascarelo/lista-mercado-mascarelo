// Envia as notificações da Lista de Mercado - Mascarelo (Firebase Cloud Messaging).
// Mesmo esquema do Bolão F1: roda no GitHub Actions com a conta de serviço do Firebase.
//
// Uso: node avisos/enviar.js                      -> rotina normal (procura listas recém-concluídas e avisa)
//      node avisos/enviar.js teste todos          -> notificação de teste para todos os aparelhos ativados
//      node avisos/enviar.js teste thiago,rafael  -> teste só para os aparelhos desses usuários
//      MENSAGEM="texto" node avisos/enviar.js teste todos   -> teste com texto próprio
// Variáveis: GOOGLE_APPLICATION_CREDENTIALS (chave) | SIMULAR=1 (não envia, só mostra)
const fs = require('fs');

const SITE = 'https://mascarelo.github.io/lista-mercado-mascarelo/';
const ICONE = SITE + 'icons/mercado-192.png';
// Lista concluída há mais tempo que isso e ainda sem aviso (ex.: primeira vez que o robô roda) é só marcada, sem notificar.
const MAX_ATRASO = 6 * 36e5;

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

// Aparelhos que ativaram o aviso e cujo dono ainda tem acesso ao app
async function aparelhosAtivos(db) {
  const [devs, users] = await Promise.all([db.collection('dispositivos').get(), db.collection('users').get()]);
  const ativos = new Map(users.docs.map((u) => [u.id, u.data()]));
  return devs.docs.map((d) => d.data())
    .filter((d) => d.token && d.prefs && d.prefs.concluida === true && ativos.has(d.uid))
    .map((d) => ({ ...d, username: (ativos.get(d.uid) || {}).username }));
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
        webpush: { fcmOptions: { link }, notification: { icon: ICONE } }
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

// Marca a lista como avisada de forma atômica (o vigia e o robô de 10 min nunca avisam a mesma lista duas vezes).
// Devolve 'enviar', 'antiga' (só marcou) ou null (já tinha sido avisada).
async function reservar(db, ref, agora) {
  return db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists) return null;
    const l = d.data();
    if (l.status !== 'closed' || l.avisoConcluidaEm) return null;
    const antiga = agora - ms(l.closedAt) > MAX_ATRASO;
    tx.update(ref, { avisoConcluidaEm: new Date(agora).toISOString(), avisoConcluidaStatus: antiga ? 'antiga, sem aviso' : 'enviado' });
    return antiga ? 'antiga' : 'enviar';
  });
}

async function rodar({ db, messaging, agora = Date.now(), simular = false, log = console.log }) {
  const saida = [];
  const enviar = criarEnviar({ db, messaging, simular, log, saida });
  const fechadas = (await db.collection('lists').where('status', '==', 'closed').get()).docs
    .filter((d) => !d.data().avisoConcluidaEm);
  if (!fechadas.length) { log('Nenhuma lista nova concluída.'); return saida; }
  let devs = null;
  for (const d of fechadas) {
    const r = await reservar(db, d.ref, agora);
    if (!r) continue;
    const l = d.data();
    if (r === 'antiga') { log('Lista antiga, só marcada (sem aviso): ' + l.name); continue; }
    if (!devs) devs = await aparelhosAtivos(db);
    await enviar(devs.map((x) => x.token), textoConcluida(l), SITE + '#/historico/' + d.id, 'concluida_' + d.id);
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
  initializeApp({ credential: cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  const db = getFirestore(), messaging = getMessaging();
  const simular = !!process.env.SIMULAR;
  if (process.argv[2] === 'teste') return teste({ db, messaging, simular, alvo: process.argv[3], mensagem: process.env.MENSAGEM });
  await rodar({ db, messaging, simular });
}

module.exports = { rodar, teste, textoConcluida, reservar, aparelhosAtivos, criarEnviar };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error('ERRO', e.message); process.exit(1); });
