// ITEMS, SUB, OUT e HAS vêm de data.js
const CAT = {R:{n:'Revenda', cls:'Conveniencia&Bebidas'}, I:{n:'Insumos', cls:'Insumos'}, D:{n:'Descartáveis', cls:'Descartaveis'}};
const UNDS = {'19':'RESTAURANTE RESENDE','20':'RESTAURANTE PORTO REAL','21':'RESTAURANTE CAÇAPAVA','18':'RESTAURANTE MOREIRA CESAR'};
const KEY = 'contagem_inventario_v2';
const $ = id => document.getElementById(id);

// índices
const strip = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const norm = s => { s = String(s||'').trim(); return /^\d+$/.test(s) ? (s.replace(/^0+/, '') || '0') : s.toUpperCase(); };
const idx = new Map(), byCod = new Map();
function put(k,i){ k = norm(k); if(k && !idx.has(k)) idx.set(k,i); }
ITEMS.forEach((r,i)=>{ byCod.set(r[0], i); put(r[5], i); });
ITEMS.forEach((r,i)=>{ if(r[7]) r[7].split('|').forEach(b => put(b, i)); });
ITEMS.forEach((r,i)=> put(r[0], i));
ITEMS.forEach((r,i)=> put(r[6], i));
const outIdx = new Map();
OUT.forEach((r,i)=>{ [r[3], r[0], r[4]].concat(r[5] ? r[5].split('|') : []).forEach(k => { k = norm(k); if(k && !outIdx.has(k) && !idx.has(k)) outIdx.set(k, i); }); });
const SEARCH = ITEMS.map(r => strip(r[1] + ' ' + r[0]));
const hasSet = {}; Object.keys(HAS).forEach(u => hasSet[u] = new Set(HAS[u]));
const hasHere = i => !!(hasSet[S.und] && hasSet[S.und].has(i));
let subTotal = {R:{}, I:{}, D:{}};
function computeTotals(){
  subTotal = {R:{}, I:{}, D:{}};
  (HAS[S.und] || []).forEach(i => { const r = ITEMS[i]; subTotal[r[8]][r[3]] = (subTotal[r[8]][r[3]]||0) + 1; });
}

// ---------- estado ----------
let S = {und:'', dt:'', contador:'', auto1:false, data:{}}; // data[und] = {counts:{}}
try{ const j = localStorage.getItem(KEY); if(j) S = Object.assign(S, JSON.parse(j)); }catch(e){}
if(!S.dt){ const d = new Date(), p = n => String(n).padStart(2,'0'); S.dt = d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
const counts = () => { if(!S.und) return {}; return (S.data[S.und] = S.data[S.und] || {counts:{}}).counts; };
let tab = 'R';

//util 
const DEC = 4;
const r4 = n => Math.round(n * 1e4) / 1e4;
const fmt = n => String(r4(n)).replace('.', ',');
const parseQ = s => { s = String(s).trim().replace('.', ','); if(!/^\d+(,\d{1,4})?$/.test(s)) return NaN; return parseFloat(s.replace(',', '.')); };
const cleanQty = v => { v = String(v).replace(/\./g, ',').replace(/[^\d,]/g, ''); const i = v.indexOf(','); return i < 0 ? v : v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, '').slice(0, DEC); };
document.addEventListener('input', ev => {
  const el = ev.target; if(!el || !(el.id === 'qty' || el.id === 'nd_qty' || (el.classList && el.classList.contains('rq')))) return;
  const c = cleanQty(el.value); if(c === el.value) return;
  const pos = Math.min(el.selectionStart == null ? c.length : el.selectionStart, c.length);
  el.value = c; try{ el.setSelectionRange(pos, pos); }catch(e){}
});
let actx; function beep(ok){ try{ actx = actx || new (window.AudioContext||window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = ok?880:220; g.gain.value = .08; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (ok?.08:.25)); }catch(e){} }
function say(t, cls){ const m = $('msg'); m.textContent = t; m.className = cls||''; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const needUnd = () => { if(S.und) return true; say('Antes de começar, escolha o restaurante lá em cima. 🙂', 'err'); beep(false); $('und').focus(); return false; };

// abas
function setTab(t){
  tab = t; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const stage = t !== 'T';
  $('stage').classList.toggle('hide', !stage); $('cons').classList.toggle('hide', stage);
  if(stage){ hideCards(); $('sheettitle').textContent = 'Ficha de contagem — ' + CAT[t].n; fillSubSel(); renderSheet(); say('',''); focusScan(); }
  else renderCons();
  updateBadges();
}
document.getElementById('tabs').addEventListener('click', ev => { const b = ev.target.closest('button'); if(b) setTab(b.dataset.t); });
function updateProgress(){
  if(tab === 'T' || !$('progbar')) return;
  const total = Object.values(subTotal[tab]).reduce((a,b) => a + b, 0);
  const feito = Object.values(counts()).filter(e => e.cat === tab && !e.nd).length;
  const pct = total ? Math.min(100, Math.round(feito * 100 / total)) : 0;
  $('progbar').style.width = pct + '%';
  $('progtxt').textContent = !S.und ? 'Escolha o restaurante para começar' : (total ? feito + ' de ' + total + ' itens · ' + pct + '%' : 'Nenhum item com saldo nesta etapa');
}
function updateBadges(){
  const c = {R:0,I:0,D:0}; Object.values(counts()).forEach(e => c[e.cat]++);
  $('nR').textContent = c.R; $('nI').textContent = c.I; $('nD').textContent = c.D; $('nT').textContent = c.R + c.I + c.D;
  updateProgress();
}

//leitura / cartão do item
let cur = null;
function hideCards(){ $('item').classList.add('hide'); $('nd').classList.add('hide'); $('hits').classList.add('hide'); cur = null; }
function focusScan(){ $('scan').value = ''; $('scan').focus(); }

function addQty(i, q, replace, cat){
  const r = ITEMS[i], C = counts();
  const e = C[r[0]] || (C[r[0]] = {cod:r[0], desc:r[1], subcod:r[2], sub:SUB[r[3]][0], un:r[4], barra:r[5], qty:0, cat:cat});
  e.qty = r4(replace ? q : e.qty + q); e.ts = new Date().toISOString();
  save(); updateBadges(); return e;
}

function openItem(i){
  cur = i; const r = ITEMS[i], e = counts()[r[0]];
  $('hits').classList.add('hide'); $('nd').classList.add('hide');
  $('i_name').textContent = r[1];
  $('i_meta').textContent = 'Cód. ' + r[0] + ' · ' + (r[4]||'') + ' · ' + SUB[r[3]][0] + (r[5] && r[5] !== r[0] ? ' · Barras ' + r[5] : '') + (r[9] === 'N' ? ' · ITEM INATIVO NO CADASTRO' : '');
  let msg = e ? 'Já contado: ' + fmt(e.qty) + ' ' + (r[4]||'') + ' (' + CAT[e.cat].n + ')' : '';
  if(!e && r[8] && tab !== 'T' && r[8] !== tab) msg = 'Este item é de ' + CAT[r[8]].n + ' — será contado lá.';
  $('already').textContent = msg; $('already').classList.toggle('hide', !msg);
  $('item').classList.remove('hide'); $('qty').value = ''; $('qty').focus();
}

function onScan(raw){
  const code = raw.trim(); if(!code) return;
  if(!needUnd()) return;
  const i = idx.get(norm(code));
  if(i !== undefined && !hasHere(i)){ beep(false); hideCards(); say('⛔ ' + ITEMS[i][1] + ' — sem saldo no sistema neste restaurante. Não contar.', 'err'); return; }
  if(i !== undefined){
    beep(true);
    if(S.auto1){
      const e = addQty(i, 1, false, counts()[ITEMS[i][0]]?.cat || ITEMS[i][8]);
      hideCards(); say('✔ ' + ITEMS[i][1] + ' → ' + fmt(e.qty) + ' (' + CAT[e.cat].n + ')', 'ok'); renderSheetSoft(); focusScan();
    } else { say('',''); openItem(i); }
    return;
  }
  const oi = outIdx.get(norm(code));
  if(oi !== undefined){ beep(false); hideCards(); say('⛔ ' + OUT[oi][1] + ' — ' + (OUT[oi][6] === 'S' ? 'sem saldo no sistema. Não contar.' : 'subgrupo ' + SUB[OUT[oi][2]][0] + ' fica fora da contagem (não é Revenda, Insumo nem Descartável). Não contar.'), 'err'); return; }
  if(!/^\d{6,}$/.test(code)){
    const terms = strip(code).split(/\s+/).filter(Boolean), out = [];
    for(let j=0;j<ITEMS.length && out.length<30;j++){ if(hasHere(j) && terms.every(t => SEARCH[j].includes(t))) out.push(j); }
    if(out.length){
      hideCards();
      $('hitlist').innerHTML = out.map(j => '<button data-i="'+j+'">'+esc(ITEMS[j][1])+' <span class="mut">· '+esc(ITEMS[j][0])+' · '+esc(SUB[ITEMS[j][3]][0])+'</span></button>').join('');
      $('hits').classList.remove('hide'); say(out.length + ' resultado(s)', ''); return;
    }
  }
  beep(false); hideCards();
  if(!/^\d+$/.test(code)){
    const terms = strip(code).split(/\s+/).filter(Boolean);
    const nm = (nm_ => { const k = ITEMS.findIndex((r,j) => !hasHere(j) && terms.every(x => SEARCH[j].includes(x))); return k >= 0 ? '⛔ ' + ITEMS[k][1] + ' — sem saldo no sistema neste restaurante. Não contar.' : ''; })();
    const o = nm ? null : OUT.find(r => { const s = strip(r[1]); return terms.every(x => s.includes(x)); });
    say(nm || (o ? '⛔ ' + o[1] + ' — ' + (o[6] === 'S' ? 'sem saldo no sistema. Não contar.' : 'subgrupo ' + SUB[o[2]][0] + ' fica fora da contagem. Não contar.') : 'Nenhum item encontrado para "' + code + '".'), 'err'); return;
  }
  $('nd_code').textContent = code; $('nd_desc').value = ''; $('nd_qty').value = '';
  $('nd').dataset.code = code; $('nd').classList.remove('hide'); $('nd_desc').focus(); say('','');
}
$('scan').addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); const v = $('scan').value; $('scan').value=''; onScan(v); renderSheet(); }});
$('scan').addEventListener('input', () => renderSheet());
$('hitlist').addEventListener('click', ev => { const b = ev.target.closest('button'); if(b){ if(!needUnd()) return; openItem(+b.dataset.i); }});

function confirmQty(replace){
  if(cur === null) return;
  const q = parseQ($('qty').value);
  if(!isFinite(q) || q < 0){ say('Digite uma quantidade válida (número, até 4 casas decimais).', 'err'); $('qty').focus(); return; }
  const ex = counts()[ITEMS[cur][0]], cat = ex ? ex.cat : ITEMS[cur][8];
  const e = addQty(cur, q, replace, cat);
  say('✔ ' + ITEMS[cur][1] + ' → total ' + fmt(e.qty) + ' (' + CAT[e.cat].n + ')', 'ok');
  hideCards(); renderSheet(); focusScan();
}
$('add').onclick = () => confirmQty(false);
$('set').onclick = () => confirmQty(true);
$('cancel').onclick = () => { hideCards(); say('',''); focusScan(); };
$('qty').addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); confirmQty(false); } else if(ev.key === 'Escape') $('cancel').click(); });

function addND(){
  const code = $('nd').dataset.code, desc = $('nd_desc').value.trim(), q = parseQ($('nd_qty').value);
  if(!desc){ say('Informe a descrição.', 'err'); $('nd_desc').focus(); return; }
  if(!isFinite(q) || q < 0){ say('Digite uma quantidade válida.', 'err'); $('nd_qty').focus(); return; }
  const C = counts(), k = 'ND:' + code, cat = tab !== 'T' ? tab : 'R';
  const e = C[k] || (C[k] = {cod:'', desc:desc, subcod:'', sub:'NÃO CADASTRADO', un:'', barra:code, qty:0, cat:cat, nd:true});
  e.qty = r4(e.qty + q); e.desc = desc; e.ts = new Date().toISOString();
  save(); updateBadges(); hideCards(); say('✔ Registrado como não cadastrado: ' + desc, 'ok'); focusScan();
}
$('nd_add').onclick = addND;
$('nd_cancel').onclick = () => { hideCards(); say('',''); focusScan(); };
['nd_desc','nd_qty'].forEach(id => $(id).addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); id === 'nd_desc' ? $('nd_qty').focus() : addND(); }}));

// ficha (lista por subgrupo)
function fillSubSel(){
  if(tab === 'T') return;
  const sel = $('subsel'), keep = sel.value, cls = tab;
  const C = counts(), done = {};
  Object.values(C).forEach(e => { if(e.cat === cls && e.cod){ const i = byCod.get(e.cod); if(i !== undefined) done[ITEMS[i][3]] = (done[ITEMS[i][3]]||0) + 1; } });
  let h = '<option value="">— escolha o subgrupo —</option>';
  const mine = SUB.map((s,k)=>[k,s]).filter(([k,s]) => subTotal[cls][k]).sort((a,b) => a[1][0].localeCompare(b[1][0]));
  h += mine.map(([k,s]) => '<option value="'+k+'">'+esc(s[0])+' ('+(done[k]||0)+'/'+subTotal[cls][k]+')</option>').join('');
  sel.innerHTML = h; if([...sel.options].some(o => o.value === keep)) sel.value = keep;
}
let shown = [];
function renderSheet(){
  const cls = tab; if(cls === 'T') return;
  const sub = $('subsel').value, mode = $('viewmode').value;
  const q = strip($('scan').value).trim(), terms = q.split(/\s+/).filter(Boolean), searching = q.length >= 2 && !/^\d{8,}$/.test(q);
  const C = counts(); let list = [];
  if(!sub && !searching){ $('sheet').innerHTML = ''; $('sheethint').textContent = S.und ? 'Escolha um subgrupo (ou digite parte do nome no campo de cima) para ver a ficha desta etapa. Só aparecem itens com saldo neste restaurante.' : 'Escolha o restaurante lá em cima para ver a ficha.'; shown = []; return; }
  for(let i=0;i<ITEMS.length;i++){
    if(!hasHere(i)) continue;
    const r = ITEMS[i];
    if(sub && String(r[3]) !== sub) continue;
    if(r[8] !== cls) continue;
    if(searching && !terms.every(t => SEARCH[i].includes(t))) continue;
    const e = C[r[0]], isDone = !!e;
    if(mode === 'todo' && isDone) continue; if(mode === 'done' && !isDone) continue;
    list.push(i);
  }
  list.sort((a,b) => ITEMS[a][1].localeCompare(ITEMS[b][1]));
  const total = list.length; list = list.slice(0, 300); shown = list;
  $('sheethint').textContent = total + ' item(ns)' + (total > 300 ? ' — mostrando os 300 primeiros; refine o subgrupo ou a busca' : '');
  $('sheet').innerHTML = list.map(i => { const r = ITEMS[i], e = C[r[0]];
    return '<tr data-i="'+i+'" class="'+(e?'done':'')+'"><td>'+esc(r[0])+'</td><td>'+esc(r[1])+('')+'<div class="mut">'+esc(SUB[r[3]][0])+'</div></td><td>'+esc(r[4])+'</td>' +
      '<td style="text-align:right"><input class="rq" inputmode="decimal" value="'+(e?fmt(e.qty):'')+'" placeholder="—"></td></tr>'; }).join('');
}
function renderSheetSoft(){ renderSheet(); fillSubSel(); }
function commitRow(inp){
  const tr = inp.closest('tr'), i = +tr.dataset.i, r = ITEMS[i], C = counts(), e = C[r[0]], v = inp.value.trim();
  if(!needUnd()){ inp.value = ''; return; }
  if(v === ''){ if(e){ delete C[r[0]]; tr.classList.remove('done'); save(); updateBadges(); fillSubSel(); } return; }
  const q = parseQ(v); if(!isFinite(q) || q < 0){ inp.value = e ? fmt(e.qty) : ''; say('Quantidade inválida.', 'err'); return; }
  if(e && e.qty === q) return;
  addQty(i, q, true, e ? e.cat : r[8]); tr.classList.add('done'); inp.value = fmt(q); fillSubSel();
}
$('sheet').addEventListener('change', ev => { if(ev.target.classList.contains('rq')) commitRow(ev.target); });
$('sheet').addEventListener('keydown', ev => {
  if(ev.key === 'Enter' && ev.target.classList.contains('rq')){ ev.preventDefault(); commitRow(ev.target);
    const nx = ev.target.closest('tr').nextElementSibling; if(nx){ const n = nx.querySelector('.rq'); n.focus(); n.select(); nx.scrollIntoView({block:'nearest'}); } else focusScan(); }
});
$('sheet').addEventListener('focusin', ev => { if(ev.target.classList.contains('rq')) ev.target.select(); });
$('subsel').onchange = renderSheet; $('viewmode').onchange = renderSheet;

// consolidado
function sortedEntries(){
  const order = {R:0,I:1,D:2};
  return Object.entries(counts()).sort((a,b) => order[a[1].cat]-order[b[1].cat] || (a[1].sub||'').localeCompare(b[1].sub||'') || a[1].desc.localeCompare(b[1].desc));
}
function renderCons(){
  $('consund').textContent = S.und ? S.und + ' · ' + UNDS[S.und] : 'escolha o restaurante';
  const c = {R:0,I:0,D:0}; Object.values(counts()).forEach(e => c[e.cat]++);
  $('sum').innerHTML = ['R','I','D'].map(k => '<div><span class="mut">'+CAT[k].n+'</span><b>'+c[k]+'</b>itens</div>').join('') + '<div><span class="mut">Total</span><b>'+(c.R+c.I+c.D)+'</b>itens</div>';
  const fc = $('fcat').value, f = strip($('ffilter').value).trim();
  $('ctb').innerHTML = sortedEntries().filter(([k,e]) => (!fc || e.cat === fc) && (!f || strip(e.desc+' '+e.cod+' '+e.barra).includes(f))).slice(0, 500).map(([k,e]) =>
    '<tr><td><span class="chip '+e.cat+'">'+CAT[e.cat].n+'</span></td><td>'+esc(e.cod||'—')+'</td><td>'+esc(e.desc)+(e.nd?' <span class="mut">(não cadastrado)</span>':'')+'</td><td>'+esc(e.un)+'</td><td class="q">'+fmt(e.qty)+'</td>' +
    '<td style="white-space:nowrap"><button data-edit="'+esc(k)+'">Editar</button> <button class="danger" data-del="'+esc(k)+'">✕</button></td></tr>').join('');
}
$('ctb').addEventListener('click', ev => {
  const b = ev.target.closest('button'); if(!b) return; const C = counts();
  if(b.dataset.del){ const e = C[b.dataset.del]; if(e && confirm('Remover "' + e.desc + '" da contagem?')){ delete C[b.dataset.del]; save(); renderCons(); updateBadges(); } }
  if(b.dataset.edit){ const e = C[b.dataset.edit]; if(!e) return; const v = prompt('Quantidade total de "' + e.desc + '":', fmt(e.qty)); if(v === null) return; const q = parseQ(v); if(!isFinite(q) || q < 0){ alert('Quantidade inválida.'); return; } e.qty = q; e.ts = new Date().toISOString(); save(); renderCons(); }
});
$('fcat').onchange = renderCons; $('ffilter').oninput = renderCons;
$('clear').onclick = () => { if(!S.und) return; if(Object.keys(counts()).length && confirm('Zerar TODA a contagem do restaurante ' + S.und + '? Exporte o CSV antes se precisar.')){ S.data[S.und] = {counts:{}}; save(); renderCons(); updateBadges(); } };

// exportação
const q = v => { v = String(v==null?'':v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
function download(name, text){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], {type:'text/csv;charset=utf-8'}));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function stamp(){ const d = new Date(), p = n => String(n).padStart(2,'0'); return S.dt.replace(/-/g,'') + '_' + p(d.getHours()) + p(d.getMinutes()); }
function exportCsv(kind){
  if(!S.und){ $('cmsg').textContent = 'Escolha o restaurante no topo.'; return; }
  const rows = sortedEntries().map(x => x[1]); if(!rows.length){ $('cmsg').textContent = 'Nada contado ainda.'; return; }
  let lines, name;
  if(kind === 'imp'){
    lines = rows.map(e => (e.barra || e.cod) + ';' + fmt(e.qty)); name = 'importacao_' + S.und + '_' + stamp() + '.csv';
  } else {
    lines = ['class_contagem;cod_und;cod_item;des_item;cod_barras;cod_subgrupo;des_subgrupo;des_med;qtd_cont;data_contagem;contador'].concat(
      rows.map(e => [CAT[e.cat].cls, S.und, e.cod, e.desc, e.barra, e.subcod, e.sub, e.un, fmt(e.qty), S.dt, S.contador].map(q).join(';'))); name = 'contagem_' + S.und + '_' + stamp() + '.csv';
  }
  download(name, lines.join('\r\n')); $('cmsg').textContent = 'Gerado: ' + name + ' (' + rows.length + ' itens)';
}
$('expImp').onclick = () => exportCsv('imp'); $('expRet').onclick = () => exportCsv('ret');

//importar / mesclar
function parseCsv(t){
  const out = []; let row = [], cur = '', inq = false; t = t.replace(/^﻿/, '');
  for(let i=0;i<t.length;i++){ const c = t[i];
    if(inq){ if(c === '"'){ if(t[i+1] === '"'){ cur += '"'; i++; } else inq = false; } else cur += c; }
    else if(c === '"') inq = true; else if(c === ';'){ row.push(cur); cur = ''; }
    else if(c === '\n'){ row.push(cur); out.push(row); row = []; cur = ''; } else if(c !== '\r') cur += c; }
  if(cur !== '' || row.length){ row.push(cur); out.push(row); } return out;
}
$('impBtn').onclick = () => $('impFile').click();
$('impFile').onchange = async () => {
  const f = $('impFile').files[0]; if(!f) return; const rows = parseCsv(await f.text()); $('impFile').value = '';
  const h = rows.shift(); const col = n => h.indexOf(n);
  if(col('class_contagem') < 0 || col('cod_und') < 0 || col('qtd_cont') < 0){ $('cmsg').textContent = 'Arquivo não reconhecido: use o "CSV completo" exportado por esta ferramenta.'; return; }
  const inv = {}; Object.entries(CAT).forEach(([k,v]) => inv[v.cls] = k); let n = 0;
  rows.forEach(r => { if(r.length < 9) return; const und = r[col('cod_und')], cat = inv[r[col('class_contagem')]]; if(!UNDS[und] || !cat) return;
    const d = (S.data[und] = S.data[und] || {counts:{}}).counts, cod = r[col('cod_item')], barra = r[col('cod_barras')], k = cod || ('ND:' + barra), qv = parseQ(r[col('qtd_cont')]); if(!isFinite(qv)) return;
    const e = d[k] || (d[k] = {cod, desc:r[col('des_item')], subcod:r[col('cod_subgrupo')], sub:r[col('des_subgrupo')], un:r[col('des_med')], barra, qty:0, cat, nd:!cod});
    e.qty = r4(e.qty + qv); e.ts = new Date().toISOString(); n++; });
  save(); renderCons(); updateBadges(); $('cmsg').textContent = n + ' linha(s) mescladas (somadas por restaurante e item). Confira o restaurante selecionado no topo.';
};

//config
$('und').value = S.und; $('dt').value = S.dt; $('contador').value = S.contador; $('auto1').checked = !!S.auto1;
$('und').onchange = () => { S.und = $('und').value; save(); computeTotals(); updateBadges(); fillSubSel(); tab === 'T' ? renderCons() : (hideCards(), renderSheet(), focusScan()); };
$('dt').onchange = () => { S.dt = $('dt').value; save(); };
$('contador').oninput = () => { S.contador = $('contador').value; save(); };
$('auto1').onchange = () => { S.auto1 = $('auto1').checked; save(); focusScan(); };
window.addEventListener('beforeunload', e => { if(Object.values(S.data).some(d => Object.keys(d.counts).length)){ e.preventDefault(); e.returnValue = ''; } });
computeTotals(); setTab('R');
