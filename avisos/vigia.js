// Vigia contínuo dos avisos (mesma ideia do Bolão F1): fica LIGADO observando o banco em tempo real e avisa em ~1 minuto,
// em vez de esperar o agendador do GitHub (que costuma atrasar de 25 a 45 min). Vale para lista criada e lista concluída. Usa a mesma rotina de avisos/enviar.js,
// então mensagens e a trava contra aviso repetido são as mesmas. O robô de 10 em 10 minutos (avisos.yml) continua como reserva.
//
// Quando fica ligado: todos os dias, das 7h às 23h (horário de Brasília). Fora disso encerra na hora.
// Uso: node avisos/vigia.js   (VIGIA_SEMPRE=1 ignora o horário, SIMULAR=1 não envia)
const fs = require('fs');
const { rodar, lerChave } = require('./enviar.js');

const MIN = 6e4, BRT = -3 * 60 * MIN;          // Brasília = UTC-3 (sem horário de verão)
const INICIO = 7, FIM = 23;                     // janela diária, em horas de Brasília
const DURACAO = 330 * MIN;                      // 5h30 por turno (o limite do GitHub é 6h)
const TICK = 5 * MIN;                           // conferência periódica de segurança
const DEBOUNCE = 4e3;                           // junta várias gravações seguidas numa só conferência

// Fim da janela de hoje (23h BRT) se "agora" estiver dentro dela, senão null
function fimDaJanela(agora) {
  const b = new Date(agora.getTime() + BRT), h = b.getUTCHours();
  if (h < INICIO || h >= FIM) return null;
  const f = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), FIM, 0, 0);
  return new Date(f - BRT);
}

async function vigiar({ db, messaging, simular, log = console.log, agora = () => new Date(), duracao = DURACAO, tick = TICK, debounce = DEBOUNCE, sempre = false }) {
  const fimJ = sempre ? null : fimDaJanela(agora());
  if (!sempre && !fimJ) { log('Fora do horário do vigia (' + INICIO + 'h às ' + FIM + 'h): o robô de 10 em 10 minutos cuida dos avisos.'); return { conferencias: 0 }; }
  const fim = Date.now() + (fimJ ? Math.min(duracao, fimJ - agora()) : duracao);
  log('Vigia ligado até ' + new Date(fim).toISOString());

  let rodando = false, pendente = false, n = 0, timer = null;
  const conferir = async () => {
    if (rodando) { pendente = true; return; }
    rodando = true;
    try {
      do {
        pendente = false; n++;
        try { const s = await rodar({ db, messaging, simular, log: () => {} }); s.forEach((x) => log('Enviado: ' + x.title + ' (' + x.para + ' aparelho(s))')); }
        catch (e) { log('Erro na conferência (segue vigiando): ' + e.message); }
      } while (pendente);
    } finally { rodando = false; }
  };
  const agendar = () => { clearTimeout(timer); timer = setTimeout(conferir, debounce); };

  let primeiro = true;
  const parar = db.collection('lists').onSnapshot( // qualquer lista criada ou concluída
    () => { if (primeiro) { primeiro = false; return; } agendar(); },
    (e) => log('Erro no observador: ' + e.message)
  );
  let primeiroP = true;
  const pararP = db.collection('pedidosSenha').onSnapshot( // "Esqueci minha senha": avisa o administrador logo
    () => { if (primeiroP) { primeiroP = false; return; } agendar(); },
    (e) => log('Erro no observador de pedidos: ' + e.message)
  );
  await conferir();
  const iv = setInterval(conferir, tick);
  await new Promise((ok) => { const t = setInterval(() => { if (Date.now() >= fim) { clearInterval(t); ok(); } }, 1000); });
  clearInterval(iv); clearTimeout(timer); parar(); pararP();
  while (rodando) await new Promise((r) => setTimeout(r, 200));
  log('Vigia encerrado após ' + n + ' conferência(s).');
  return { conferencias: n };
}

async function main() {
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getMessaging } = require('firebase-admin/messaging');
  initializeApp({ credential: cert(lerChave(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'))) });
  await vigiar({ db: getFirestore(), messaging: getMessaging(), simular: !!process.env.SIMULAR, sempre: !!process.env.VIGIA_SEMPRE });
}
module.exports = { vigiar, fimDaJanela };
if (require.main === module) main().then(() => process.exit(0)).catch((e) => { console.error('ERRO', e.message); process.exit(1); });
