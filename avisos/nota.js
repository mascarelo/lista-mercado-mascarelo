// Leitura da nota fiscal (NFC-e de SP) pelo QR code: o app grava o link na lista concluída (nota.status = "buscando"),
// este robô abre a página pública da Fazenda de SP, lê os itens e os preços e faz o "par" de cada item da nota
// com um item comprado da lista. O que sobra da nota entra como "comprado fora da lista".
// Também mantém config/precos (preço médio de cada item, usado quando um item comprado não aparece na nota).
const SP = /^https:\/\/(www\.)?nfce\.fazenda\.sp\.gov\.br\/NFCeConsultaPublica\/Paginas\/ConsultaQRCode\.aspx\?p=\d{44}\|/i;
const ESPERA = [2, 5, 10, 20, 30, 60, 60, 120, 120, 240, 240, 480]; // minutos entre tentativas (a nota pode levar até 30 min para aparecer)

const ms = (t) => { const v = t && typeof t.toMillis === 'function' ? t.toMillis() : t ? +new Date(t) : 0; return Number.isFinite(v) ? v : 0; };
const num = (t) => { const v = parseFloat(String(t || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(v) ? v : 0; };
const limpa = (t) => String(t || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// mesma chave do app (chaveItem): nome sem acento, minúsculo, só letras/números/espaço
const chave = (nome) => semAcento(nome).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || '-';

/** Aceita o link do QR code em qualquer formato da Fazenda de SP (.../qrcode?p=..., http, "|" codificado) e devolve o
 *  link da consulta pública; null se não for nota de SP. */
function linkNotaSP(texto) {
  try {
    const u = new URL(String(texto || '').trim());
    if (!/^https?:$/.test(u.protocol) || !/(^|\.)nfce\.fazenda\.sp\.gov\.br$/i.test(u.hostname)) return null;
    const pm = [...u.searchParams.entries()].find(([k]) => k.toLowerCase() === 'p');
    const val = pm ? pm[1].replace(/%7C/gi, '|').trim() : '';
    if (!/^\d{44}\|[0-9A-Za-z|]+$/.test(val)) return null;
    return 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=' + val;
  } catch (_) { return null; }
}

/** Lê a página da Fazenda de SP. Devolve { loja, cnpj, emissao, total, desconto, itens: [{ d, q, un, vu, vt }] } ou null. */
function lerPagina(html) {
  const s = String(html || '');
  const itens = [];
  for (const bloco of s.split(/<tr id="Item \+ \d+">/).slice(1)) {
    const d = limpa((bloco.match(/<span class="txtTit">([^<]*)<\/span>/) || [])[1]);
    if (!d) continue;
    const q = num((bloco.match(/class="Rqtd">[\s\S]*?<\/strong>([^<]*)</) || [])[1]);
    const un = limpa((bloco.match(/class="RUN">[\s\S]*?<\/strong>([^<]*)</) || [])[1]);
    const vu = num((bloco.match(/class="RvlUnit">[\s\S]*?<\/strong>([^<]*)</) || [])[1]);
    const vt = num((bloco.match(/class="valor">([^<]*)</) || [])[1]);
    itens.push({ d, q: q || 1, un, vu: vu || (q ? Math.round((vt / q) * 100) / 100 : vt), vt });
  }
  if (!itens.length) return null;
  const valorDe = (rotulo) => num((s.match(new RegExp('<label>\\s*' + rotulo + '[^<]*<\\/label>\\s*<span class="totalNumb[^"]*">([^<]*)<')) || [])[1]);
  const total = valorDe('Valor a pagar') || valorDe('Valor total') || Math.round(itens.reduce((a, x) => a + x.vt, 0) * 100) / 100;
  const em = (s.match(/Emiss[ãa]o:\s*<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/) || []);
  return {
    loja: limpa((s.match(/class="txtTopo">([^<]*)</) || [])[1]),
    cnpj: limpa((s.match(/CNPJ:\s*([\d./-]+)/) || [])[1]),
    emissao: em.length ? new Date(Date.UTC(+em[3], +em[2] - 1, +em[1], +em[4] + 3, +em[5])).toISOString() : null, // horário de Brasília -> UTC
    total, desconto: valorDe('Descontos'), itens
  };
}

// Palavras que não ajudam a parear
const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'e', 'a', 'o', 'p', 'para', 'kg', 'g', 'gr', 'ml', 'l', 'lt', 'un', 'und', 'pct', 'cx', 'tp', 'tipo']);
// Abreviações comuns nas notas (e grafias diferentes), trocadas pela palavra inteira dos dois lados
const ABREV = { qjo: 'queijo', qj: 'queijo', lte: 'leite', frgo: 'frango', fgo: 'frango', fran: 'frango', pto: 'peito', refri: 'refrigerante', refrig: 'refrigerante', ref: 'refrigerante',
  hig: 'higienico', pap: 'papel', cr: 'creme', choc: 'chocolate', achoc: 'achocolatado', marg: 'margarina', req: 'requeijao', iog: 'iogurte', biscoit: 'biscoito', bisc: 'biscoito',
  muss: 'mussarela', mucarela: 'mussarela', muzzarela: 'mussarela', mozarela: 'mussarela', mozzarela: 'mussarela', amac: 'amaciante', desod: 'desodorante',
  cond: 'condensado', integ: 'integral', desn: 'desnatado', semidesn: 'semidesnatado', trad: 'tradicional', bov: 'bovina', moid: 'moida', cerv: 'cerveja', agua: 'agua', sach: 'sache' };
const palavras = (t) => chave(t).split(' ').map((w) => ABREV[w] || w).filter((w) => w && !VAZIAS.has(w) && !/^\d+([a-z]{0,2})?$/.test(w));
/** Nota de 0 a 1 para "item da lista" x "descrição da nota". A primeira palavra do item precisa aparecer. */
function parecido(nomeItem, desc) {
  const it = palavras(nomeItem), ds = palavras(desc);
  if (!it.length || !ds.length) return 0;
  const bate = (w) => ds.some((d) => (d.length >= 2 && w.startsWith(d)) || (w.length >= 3 && d.startsWith(w)));
  if (!bate(it[0])) return 0;
  let soma = 0, peso = 0;
  it.forEach((w, i) => { const p = i === 0 ? 2 : 1; peso += p; if (bate(w)) soma += p; });
  return soma / peso;
}

/**
 * Faz os pares item da lista (comprados) x linha da nota. pares = { chaveDaDescricao: chaveDoItem } aprendidos
 * (quando alguém corrige no app). Devolve as linhas da nota com par (id do item) e pn (nome do item) ou par null.
 */
function parear(itensLista, linhas, pares = {}) {
  const comprados = itensLista.filter((x) => x.status === 'bought');
  const out = linhas.map((l) => ({ ...l, par: null, pn: null }));
  const usados = new Set();
  // 1) pares aprendidos
  out.forEach((l) => {
    const alvo = pares[chave(l.d)];
    if (!alvo) return;
    if (alvo === '-') { l.fixo = true; return; } // alguém marcou que esta linha não é de nenhum item da lista
    const it = comprados.find((x) => chave(x.name) === alvo);
    if (it) { l.par = it.id; l.pn = it.name; usados.add(it.id); }
  });
  // 2) por semelhança, do par mais certo para o menos certo (itens com nome mais completo primeiro, no empate)
  const cand = [];
  comprados.forEach((it) => out.forEach((l, j) => {
    if (l.par || l.fixo) return;
    const n = parecido(it.name, l.d);
    if (n >= 0.5) cand.push({ it, j, n, peso: palavras(it.name).length });
  }));
  cand.sort((a, b) => b.n - a.n || b.peso - a.peso || a.j - b.j);
  for (const c of cand) {
    if (usados.has(c.it.id) || out[c.j].par) continue;
    out[c.j].par = c.it.id; out[c.j].pn = c.it.name; usados.add(c.it.id);
  }
  // 3) o mesmo produto pode vir em várias linhas (ex.: duas pesagens de banana): linhas que batem 100% com um item já
  //    pareado vão para ele também
  for (const c of cand) {
    if (out[c.j].par || c.n < 1) continue;
    out[c.j].par = c.it.id; out[c.j].pn = c.it.name;
  }
  return out.map(({ fixo, ...l }) => l);
}

/** Preço médio de cada item (pela chave do nome), de todas as notas lidas: m = valor médio por compra, n = nº de notas. */
function calcularPrecos(listas) {
  const acc = {};
  for (const l of listas) {
    if (!l.nota || l.nota.status !== 'ok' || !Array.isArray(l.nota.itens)) continue;
    for (const x of l.nota.itens) {
      if (!x.par || !x.pn) continue;
      const k = chave(x.pn);
      acc[k] = acc[k] || { s: 0, n: 0 };
      acc[k].s += x.vt; acc[k].n++;
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, { m: Math.round((v.s / v.n) * 100) / 100, n: v.n }]));
}

async function buscar(url, fetchFn) {
  const r = await fetchFn(url.replace(/\|/g, '%7C'), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(40000)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

/** Rotina: lê as notas pedidas e atualiza os preços médios. */
async function lerNotas({ db, agora = Date.now(), log = console.log, fetchFn = fetch, simular = false }) {
  const listas = (await db.collection('lists').get()).docs;
  const pedidas = listas.filter((d) => { const n = d.data().nota; return n && n.status === 'buscando' && (!n.proximaEm || ms(n.proximaEm) <= agora); });
  let mudou = false;
  if (pedidas.length) {
    const paresSnap = await db.collection('paresNota').get();
    const pares = Object.fromEntries(paresSnap.docs.map((d) => [d.id, d.data().item]));
    for (const d of pedidas) {
      const l = d.data(), n = l.nota;
      if (simular) { log('Leria a nota de: ' + l.name); continue; }
      const link = linkNotaSP(n.url);
      if (!link || !SP.test(link)) {
        await d.ref.update({ 'nota.status': 'erro', 'nota.erro': 'Este QR code não é de uma nota fiscal de SP (NFC-e).' });
        log('Nota com link inválido: ' + l.name); mudou = true; continue;
      }
      let dados = null, motivo = '';
      try { dados = lerPagina(await buscar(link, fetchFn)); if (!dados) motivo = 'a página veio sem itens (a nota pode levar até 30 minutos para aparecer)'; }
      catch (e) { motivo = e.message; }
      if (!dados) {
        const t = (n.tentativas || 0) + 1;
        if (t > ESPERA.length) {
          await d.ref.update({ 'nota.status': 'erro', 'nota.tentativas': t, 'nota.erro': 'Não foi possível ler a nota no site da Fazenda (' + motivo + ').' });
          log('Nota desistida após ' + t + ' tentativas: ' + l.name);
        } else {
          await d.ref.update({ 'nota.tentativas': t, 'nota.proximaEm': new Date(agora + ESPERA[t - 1] * 6e4).toISOString(), 'nota.ultimoErro': motivo });
          log('Nota de "' + l.name + '" ainda não lida (' + motivo + '); nova tentativa em ' + ESPERA[t - 1] + ' min');
        }
        continue;
      }
      const itens = (await d.ref.collection('items').get()).docs.map((x) => ({ id: x.id, ...x.data() }));
      const linhas = parear(itens, dados.itens, pares);
      await d.ref.update({
        'nota.status': 'ok', 'nota.lidaEm': new Date(agora).toISOString(), 'nota.loja': dados.loja, 'nota.cnpj': dados.cnpj,
        'nota.emissao': dados.emissao, 'nota.total': dados.total, 'nota.desconto': dados.desconto, 'nota.itens': linhas,
        'nota.erro': null, 'nota.ultimoErro': null, 'nota.proximaEm': null
      });
      log('Nota lida: ' + l.name + ' (' + linhas.length + ' itens, ' + linhas.filter((x) => x.par).length + ' com par, R$ ' + dados.total.toFixed(2) + ')');
      mudou = true;
    }
  }
  // preços médios: recalcula de todas as notas lidas e grava só se mudou
  const todas = mudou ? (await db.collection('lists').get()).docs.map((d) => d.data()) : listas.map((d) => d.data());
  const precos = calcularPrecos(todas);
  const ref = db.doc('config/precos');
  const atual = await ref.get();
  const antes = atual.exists ? atual.data().itens || {} : {};
  if (!simular && JSON.stringify(antes) !== JSON.stringify(precos)) {
    await ref.set({ itens: precos, em: new Date(agora).toISOString() });
    log('Preços médios atualizados (' + Object.keys(precos).length + ' itens)');
  }
}

module.exports = { linkNotaSP, lerNotas, lerPagina, parear, parecido, calcularPrecos, chave, SP };
