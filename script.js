'use strict';
/* CityForge — veri → simülasyon → çizim → girdi */

// ===== MERKEZİ VERİ =====
const N = 40, T = 32, KEY = 'cityforge1', DAY = 4000;
const TER = ['#2f6f3e', '#1d4ed8', '#24583a'];
const CATS = ['Yol', 'Konut', 'Ticaret', 'Sanayi', 'Kamu', 'Elektrik', 'Su', 'Ulaşım'];
// pw: elektrik tüketimi, wt: su tüketimi, gen/wat: üretim, up: günlük bakım, tax: günlük vergi, pol: kirlilik
const B = {
  road:   { n: 'Yol', c: 'Yol', cost: 10, up: .3, col: '#475569', d: 'Binaları birbirine bağlar' },
  house:  { n: 'Küçük Ev', c: 'Konut', cost: 120, up: 1, col: '#f59e0b', pop: 6, pw: 1, wt: 1, tax: 2, d: '6 kişi' },
  apt:    { n: 'Apartman', c: 'Konut', cost: 600, up: 5, col: '#fb923c', pop: 30, pw: 4, wt: 4, tax: 9, d: '30 kişi' },
  tower:  { n: 'Gökdelen', c: 'Konut', cost: 3000, up: 20, col: '#f472b6', pop: 150, pw: 18, wt: 18, tax: 45, d: '150 kişi' },
  shop:   { n: 'Market', c: 'Ticaret', cost: 250, up: 3, col: '#38bdf8', jobs: 6, pw: 2, wt: 1, tax: 9, d: '6 iş' },
  mall:   { n: 'AVM', c: 'Ticaret', cost: 1800, up: 15, col: '#818cf8', jobs: 40, pw: 12, wt: 6, tax: 60, d: '40 iş' },
  factory:{ n: 'Fabrika', c: 'Sanayi', cost: 500, up: 6, col: '#a8a29e', jobs: 20, pw: 8, wt: 5, tax: 24, pol: 1, d: '20 iş, kirletir' },
  park:   { n: 'Park', c: 'Kamu', cost: 150, up: 1, col: '#22c55e', hap: 1, pol: -1, d: 'Mutluluk artar' },
  police: { n: 'Polis', c: 'Kamu', cost: 500, up: 6, col: '#3b82f6', pw: 2, hap: 1, jobs: 5, d: 'Güvenlik, 5 iş' },
  coal:   { n: 'Kömür Santrali', c: 'Elektrik', cost: 900, up: 10, col: '#57534e', gen: 60, pol: 2, jobs: 8, d: '+60 güç, kirletir' },
  solar:  { n: 'Güneş Paneli', c: 'Elektrik', cost: 600, up: 2, col: '#facc15', gen: 15, d: '+15 güç' },
  well:   { n: 'Su Pompası', c: 'Su', cost: 300, up: 3, col: '#06b6d4', pw: 2, wat: 40, d: '+40 su' },
  villa:  { n: 'Villa', c: 'Konut', cost: 1200, up: 8, col: '#f9a8d4', pop: 12, pw: 3, wt: 3, tax: 20, d: '12 kişi, yüksek vergi' },
  bapt:   { n: 'Büyük Apartman', c: 'Konut', cost: 1500, up: 12, col: '#fdba74', pop: 60, pw: 8, wt: 8, tax: 22, d: '60 kişi' },
  rest:   { n: 'Restoran', c: 'Ticaret', cost: 400, up: 4, col: '#f87171', jobs: 8, pw: 3, wt: 3, tax: 14, d: '8 iş' },
  office: { n: 'Ofis', c: 'Ticaret', cost: 1500, up: 10, col: '#60a5fa', jobs: 30, pw: 8, wt: 2, tax: 40, d: '30 iş' },
  hotel:  { n: 'Otel', c: 'Ticaret', cost: 2000, up: 15, col: '#c084fc', jobs: 20, pw: 10, wt: 8, tax: 55, d: '20 iş, turizm' },
  bfact:  { n: 'Büyük Fabrika', c: 'Sanayi', cost: 1500, up: 15, col: '#94a3b8', jobs: 60, pw: 25, wt: 12, tax: 80, pol: 2, d: '60 iş, çok kirletir' },
  depo:   { n: 'Depo', c: 'Sanayi', cost: 300, up: 3, col: '#a1a1aa', jobs: 8, pw: 3, wt: 1, tax: 12, d: '8 iş' },
  fire:   { n: 'İtfaiye', c: 'Kamu', cost: 500, up: 6, col: '#dc2626', pw: 2, hap: 1, jobs: 6, d: 'Güvenlik, 6 iş' },
  clinic: { n: 'Klinik', c: 'Kamu', cost: 400, up: 5, col: '#2dd4bf', pw: 2, hap: 1, jobs: 6, d: 'Sağlık, 6 iş' },
  hosp:   { n: 'Hastane', c: 'Kamu', cost: 2500, up: 25, col: '#f1f5f9', pw: 10, wt: 4, hap: 1, jobs: 30, d: 'Sağlık, 30 iş' },
  school: { n: 'Okul', c: 'Kamu', cost: 600, up: 6, col: '#fbbf24', pw: 3, hap: 1, jobs: 10, d: 'Eğitim, 10 iş' },
  wind:   { n: 'Rüzgar Türbini', c: 'Elektrik', cost: 700, up: 3, col: '#e2e8f0', gen: 20, d: '+20 güç, temiz' },
  gas:    { n: 'Doğalgaz Santrali', c: 'Elektrik', cost: 1500, up: 15, col: '#fb923c', gen: 100, pol: 1, jobs: 10, d: '+100 güç' },
  tank:   { n: 'Su Deposu', c: 'Su', cost: 500, up: 4, col: '#0ea5e9', pw: 1, wat: 80, d: '+80 su' },
  bus:    { n: 'Otobüs Durağı', c: 'Ulaşım', cost: 200, up: 2, col: '#fbbf24', tr: 3, d: 'Trafiği azaltır' },
  metro:  { n: 'Metro İstasyonu', c: 'Ulaşım', cost: 2500, up: 25, col: '#a78bfa', pw: 6, tr: 15, d: 'Trafiği çok azaltır' },
};
// Görsel stil: her bina türü Canvas'ta kendi çizim şablonuyla çizilir
const VIS = { house: 'home', villa: 'home', apt: 'block', bapt: 'block', tower: 'tower', office: 'tower', hotel: 'tower', shop: 'shop', mall: 'shop', rest: 'shop',
  factory: 'fact', bfact: 'fact', depo: 'fact', coal: 'fact', gas: 'fact', park: 'park', police: 'civic', fire: 'civic', clinic: 'civic', hosp: 'civic', school: 'civic',
  solar: 'solar', wind: 'wind', well: 'water', tank: 'water', bus: 'bus', metro: 'bus' };

// ===== DURUM =====
const $ = id => document.getElementById(id);
const cv = $('map'), ctx = cv.getContext('2d');
let S, st = {}, cam = { x: 0, y: 0, z: 1 }, tool = 'select', sel = 'road', cat = 'Yol';
let view = 'normal', hz = [], cur = null, hover = null, dirty = true, last = 0, lastDraw = 0, dpr = 1, snd = true, ac;

function newGame() {
  if (S && !confirm('Yeni oyun başlasın mı? Kayıtsız ilerleme silinir.')) return;
  const ter = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = Math.sin(x * .31) + Math.cos(y * .27) + Math.sin((x + y) * .17), c = Math.hypot(x - 20, y - 20) < 8;
    ter.push(!c && v > 1.4 ? 1 : !c && v < -1.3 ? 2 : 0);
  }
  S = { money: 5000, day: 1, t: .4, speed: 1, pop: 0, hap: 60, tax: 9, ter, g: Array(N * N).fill(null) };
  cur = null; calc(); ui(); tb(); dirty = true;
}
const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? S.g[y * N + x] : null);
const roadAdj = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const c = at(x + a, y + b); return c && c.k === 'road'; });

// ===== SİMÜLASYON =====
function calc() { // elektrik, su, nüfus kapasitesi, iş, trafik, kirlilik, gelir/gider
  let use = 0, gen = 0, wu = 0, wg = 0, cap = 0, jobs = 0, cj = 0, roads = 0, maint = 0, tr = 0;
  const H = [], P = [], G = [];
  S.g.forEach((b, i) => {
    if (!b) return;
    const d = B[b.k], l = b.l, x = i % N, y = (i / N) | 0;
    maint += d.up * l;
    if (b.k === 'road') { roads++; return; }
    b.on = roadAdj(x, y); // yola bağlı olmayan bina çalışmaz
    if (!b.on) return;
    use += (d.pw || 0) * l; wu += (d.wt || 0) * l; gen += (d.gen || 0) * l; wg += (d.wat || 0) * l; jobs += (d.jobs || 0) * l;
    if (d.c === 'Ticaret') cj += d.jobs * l;
    tr += (d.tr || 0) * l;
    if (d.pop) { cap += d.pop * l; H.push([x, y]); }
    if (d.pol) P.push([x, y, d.pol * l]);
    if (d.hap) G.push([x, y]);
  });
  const ch = (a, o) => Math.max(Math.abs(a[0] - o[0]), Math.abs(a[1] - o[1]));
  let ps = 0, cv2 = 0;
  H.forEach(h => {
    ps += Math.max(0, P.reduce((s, o) => (ch(h, o) <= 4 ? s + o[2] : s), 0));
    if (G.some(o => ch(h, o) <= 5)) cv2++;
  });
  const p = use ? Math.min(1, gen / use) : 1, w = wu ? Math.min(1, wg / wu) : 1;
  const pol = H.length ? Math.min(1, ps / H.length / 2) : 0, cov = H.length ? cv2 / H.length : 0;
  const workers = S.pop * .6, unemp = workers > 0 ? Math.max(0, 1 - jobs / workers) : 0;
  const traffic = Math.min(1, (S.pop * .25 + jobs * .3) / (roads * 12 + 1 + tr * 15)); // toplu taşıma kapasite ekler
  const occ = cap ? Math.min(1, S.pop / cap) : 0;
  let inc = 0;
  S.g.forEach(b => {
    if (!b || !b.on) return;
    const d = B[b.k];
    if (!d.tax) return;
    let v = d.tax * b.l;
    if (d.pop) v *= occ;
    else { v *= p * (1 - traffic * .3); if (d.c === 'Ticaret') v *= Math.min(1, S.pop / (cj * 4 + 1)); }
    inc += v;
  });
  const hb = [['Kamu hizmetleri', 25 * cov], ['Elektrik', -25 * (1 - p)], ['Su', -20 * (1 - w)], ['Trafik', -20 * traffic], ['Kirlilik', -30 * pol], ['Vergiler', -(S.tax - 9) * 2], ['İşsizlik', -25 * unemp]];
  st = { use, gen, wu, wg, cap, jobs, roads, exp: maint, inc: inc * S.tax / 9, p, w, pol, cov, unemp, traffic, hb };
}

function tickDay() { // her oyun günü: mutluluk, nüfus, ekonomi
  calc();
  const tg = 55 + st.hb.reduce((a, h) => a + h[1], 0);
  S.hap += (Math.max(0, Math.min(100, tg)) - S.hap) * .3;
  const before = S.pop;
  if (st.cap > S.pop && S.hap > 35 && st.p > .5 && st.unemp < .4) S.pop = Math.min(st.cap, S.pop + Math.ceil((st.cap - S.pop) * .15));
  else if (S.pop > st.cap || S.hap < 20) S.pop = Math.max(0, S.pop - Math.ceil(S.pop * .1));
  const net = Math.round(st.inc - st.exp);
  S.money = Number.isFinite(S.money + net) ? S.money + net : 0; S.day++;
  calc();
  if (S.pop > before) toast('Yeni vatandaşlar şehre geldi (+' + (S.pop - before) + ')');
  if (st.p < 1) toast('Elektrik üretimi yetersiz');
  else if (st.w < 1) toast('Su üretimi yetersiz');
  if (S.money < 0) toast('Bütçe eksiye düştü');
  saveGame(true); ui();
}

// ===== İNŞA / SİLME / YÜKSELTME =====
function place(t, q) {
  const d = B[sel], i = t.y * N + t.x, e = m => { if (!q) err(m); };
  if (S.ter[i] === 1 || S.g[i]) return e('Bu alana bina inşa edilemez.');
  if (S.money < d.cost) return e('Yeterli paran yok.');
  if (d.pw && st.gen < st.use + d.pw) return e('Bu bina için yeterli elektrik üretimi bulunmuyor.');
  S.money -= d.cost; S.g[i] = { k: sel, l: 1 };
  if ($('hint')) $('hint').remove();
  calc(); ui(); beep(520);
}
function act(t, q) {
  if (t.x < 0 || t.y < 0 || t.x >= N || t.y >= N) return;
  const i = t.y * N + t.x, b = S.g[i];
  if (tool === 'select') { cur = b ? t : null; info(); return; }
  if (tool === 'del') { if (b) { S.money += Math.floor(B[b.k].cost * b.l / 2); S.g[i] = null; calc(); ui(); beep(200); } return; }
  place(t, q);
}
function upg() {
  const b = S.g[cur.y * N + cur.x], d = B[b.k], c = Math.round(d.cost * b.l * .8);
  if (b.k === 'road' || b.l >= 3) return err('Bu bina daha fazla yükseltilemez.');
  if (S.money < c) return err('Yeterli paran yok.');
  S.money -= c; b.l++; calc(); ui(); beep(700);
}
function rem() {
  const i = cur.y * N + cur.x, b = S.g[i];
  S.money += Math.floor(B[b.k].cost * b.l / 2); S.g[i] = null;
  closeInfo(); calc(); ui(); beep(200);
}

// ===== ARAYÜZ =====
const f = n => Math.round(n).toLocaleString('tr');
function ui() {
  $('money').textContent = f(S.money) + '€';
  const net = st.inc - st.exp;
  $('inc').textContent = (net >= 0 ? '+' : '') + f(net) + '/gün';
  $('pop').textContent = f(S.pop);
  $('hap').textContent = Math.round(S.hap) + '%';
  $('pw').textContent = f(st.gen) + '/' + f(st.use);
  $('wt').textContent = f(st.wg) + '/' + f(st.wu);
  $('job').textContent = Math.round(st.unemp * 100) + '%';
  $('taxv').textContent = S.tax + '%';
  info();
}
function info() {
  const el = $('info'), b = cur && S.g[cur.y * N + cur.x];
  const row = (a, v) => (v ? `<p>${a}: <b>${v}</b></p>` : '');
  if (b) {
    const d = B[b.k], c = Math.round(d.cost * b.l * .8), l = b.l;
    el.innerHTML = `<button class="cl" onclick="closeInfo()">Kapat</button><h3>${d.n} <small>Seviye ${l}</small></h3>` +
      (b.k === 'road' || b.on ? '' : '<p class="bad">Yola bağlı değil, çalışmıyor.</p>') +
      row('Bakım', f(d.up * l) + '€/gün') + row('Vergi', d.tax ? f(d.tax * l) + '€/gün' : '') +
      row('Nüfus', d.pop ? d.pop * l : '') + row('İş', d.jobs ? d.jobs * l : '') +
      row('Elektrik', d.pw ? '-' + d.pw * l : d.gen ? '+' + d.gen * l : '') + row('Su', d.wt ? '-' + d.wt * l : d.wat ? '+' + d.wat * l : '') +
      (b.k === 'road' ? '' : `<button onclick="upg()">Yükselt ${f(c)}€</button>`) + '<button onclick="rem()">Sil</button>';
  } else {
    el.innerHTML = '<h3>Mutluluk: ' + Math.round(S.hap) + '%</h3>' + st.hb.map(h => (Math.abs(h[1]) >= .5 ? `<p class="${h[1] < 0 ? 'bad' : ''}">${h[0]} ${h[1] > 0 ? '+' : ''}${Math.round(h[1])}</p>` : '')).join('') + '<h3>Şehir özeti</h3>' + row('Nüfus', f(S.pop) + ' / ' + f(st.cap)) + row('İş', f(st.jobs)) +
      row('İşsizlik', Math.round(st.unemp * 100) + '%') + row('Trafik', Math.round(st.traffic * 100) + '%') +
      row('Kirlilik', Math.round(st.pol * 100) + '%') + row('Gelir', f(st.inc) + '€/gün') + row('Gider', f(st.exp) + '€/gün') +
      row('Elektrik', f(st.gen) + ' / ' + f(st.use)) + row('Su', f(st.wg) + ' / ' + f(st.wu));
  }
  el.classList.toggle('show', !!b);
  dirty = true;
}
function closeInfo() { cur = null; info(); }
function cards() {
  $('tabs').innerHTML = CATS.map(c => `<button class="${c === cat ? 'on' : ''}" onclick="setCat('${c}')">${c}</button>`).join('');
  $('cards').innerHTML = Object.entries(B).filter(([, d]) => d.c === cat).map(([k, d]) =>
    `<button class="card ${k === sel && tool === 'build' ? 'on' : ''}" onclick="pick('${k}')"><i style="background:${d.col}"></i><b>${d.n}</b><span>${d.cost}€</span><small>${d.d}</small></button>`).join('');
}
const setCat = c => { cat = c; cards(); beep(400); };
function pick(k) { sel = k; tool = 'build'; closeInfo(); cards(); tb(); beep(440); }
function setTool(t) { tool = t; closeInfo(); cards(); tb(); beep(400); }
function setSpeed(n) { S.speed = n; tb(); }
function tb() {
  document.querySelectorAll('#tools [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === tool));
  document.querySelectorAll('#tools [data-s]').forEach(b => b.classList.toggle('on', +b.dataset.s === S.speed));
  $('tax').value = S.tax;
}
function toast(m) {
  const d = document.createElement('div'), t = $('toasts');
  d.className = 't'; d.textContent = m; t.append(d);
  if (t.children.length > 4) t.firstChild.remove();
  setTimeout(() => d.remove(), 2600);
}
function err(m) { toast(m); beep(150, .15); }
function beep(fr, du = .08) {
  if (!snd) return;
  try {
    ac = ac || new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = fr; g.gain.value = .05; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + du);
  } catch (e) { /* ses desteklenmiyor */ }
}

// ===== KAYDET / YÜKLE =====
function saveGame(q) {
  try { localStorage.setItem(KEY, JSON.stringify(Object.assign({ version: 2 }, S))); if (!q) toast('Oyun kaydedildi.'); }
  catch (e) { toast('Kayıt başarısız oldu.'); }
}
function loadGame() {
  try {
    const r = sane(JSON.parse(localStorage.getItem(KEY)));
    if (!r) throw 0;
    S = r; cur = null; calc(); ui(); tb(); toast('Oyun yüklendi.');
  } catch (e) { err('Kayıtlı oyun bulunamadı.'); }
}

// ===== ÇİZİM (yalnızca görünen kareler, sadece gerektiğinde) =====
function draw() {
  dirty = false; hz.length = 0;
  const W = cv.width, H = cv.height, s = T * cam.z * dpr, ox = cam.x * dpr, oy = cam.y * dpr, m = s * .1, lit = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
  const x0 = Math.max(0, Math.floor(-ox / s)), y0 = Math.max(0, Math.floor(-oy / s));
  const x1 = Math.min(N, Math.ceil((W - ox) / s)), y1 = Math.min(N, Math.ceil((H - oy) / s));
  const nt = .55 * (1 - (1 + Math.cos((S.t - .5) * 6.2832)) / 2); // gece karanlığı
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = y * N + x, px = ox + x * s, py = oy + y * s, b = S.g[i];
    ctx.fillStyle = TER[S.ter[i]]; ctx.fillRect(px, py, s + .5, s + .5);
    if (!b) continue;
    const d = B[b.k];
    if (b.k === 'road') { drawRoad(x, y, px, py, s, lit); continue; }
    drawB(b, px, py, s, lit);
    ctx.fillStyle = '#fff';
    for (let k = 0; k < b.l; k++) ctx.fillRect(px + m + k * s * .2, py + s - m * 1.8, s * .14, s * .08);
    if (b.on && (d.pop || d.jobs)) lit.push(px + s * .4, py + s * .35);
  }
  if (cam.z > .7) {
    ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.beginPath();
    for (let x = x0; x <= x1; x++) { ctx.moveTo(ox + x * s, oy + y0 * s); ctx.lineTo(ox + x * s, oy + y1 * s); }
    for (let y = y0; y <= y1; y++) { ctx.moveTo(ox + x0 * s, oy + y * s); ctx.lineTo(ox + x1 * s, oy + y * s); }
    ctx.stroke();
  }
  if (view === 'pollution') { ctx.fillStyle = 'rgba(239,68,68,.16)'; for (let k = 0; k < hz.length; k += 3) { ctx.beginPath(); ctx.arc(hz[k] + s / 2, hz[k + 1] + s / 2, 4.5 * s, 0, 6.3); ctx.fill(); } }
  if (nt > .02) {
    ctx.fillStyle = `rgba(5,10,40,${nt})`; ctx.fillRect(0, 0, W, H);
    if (nt > .2) { ctx.fillStyle = '#fde68a'; for (let k = 0; k < lit.length; k += 2) ctx.fillRect(lit[k], lit[k + 1], s * .12, s * .12); }
  }
  if (hover && (tool === 'build' || tool === 'del') && hover.x >= 0 && hover.y >= 0 && hover.x < N && hover.y < N) {
    const i = hover.y * N + hover.x;
    const ok = tool === 'del' ? !!S.g[i] : !S.g[i] && S.ter[i] !== 1 && S.money >= B[sel].cost;
    const dd = B[sel], warn = ok && tool === 'build' && sel !== 'road' && (!roadAdj(hover.x, hover.y) || (dd.pw && st.gen < st.use + dd.pw));
    if (tool === 'build' && (dd.hap || dd.pol > 0)) { const r = dd.hap ? 5 : 4; ctx.lineWidth = dpr; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.strokeRect(ox + (hover.x - r) * s, oy + (hover.y - r) * s, (2 * r + 1) * s, (2 * r + 1) * s); }
    ctx.fillStyle = !ok ? 'rgba(239,68,68,.55)' : warn ? 'rgba(249,115,22,.55)' : 'rgba(34,197,94,.55)'; ctx.fillRect(ox + hover.x * s, oy + hover.y * s, s, s);
  }
  if (cur && tool === 'select') { ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#f5b942'; ctx.strokeRect(ox + cur.x * s, oy + cur.y * s, s, s); }
}
// ===== BİNA VE YOL GÖRSELLERİ (harici resim yok) =====
function drawRoad(x, y, px, py, s, lit) { // komşu yollara göre düz / köşe / T / kavşak
  const r = (a, b) => { const c = at(x + a, y + b); return !!(c && c.k === 'road'); };
  const n = r(0, -1), e = r(1, 0), so = r(0, 1), w = r(-1, 0), cnt = n + e + so + w;
  const A = view === 'traffic' ? (st.traffic < .4 ? '#22c55e' : st.traffic < .7 ? '#eab308' : '#ef4444') : '#3b4556';
  const R = (X, Y, W, H, c) => { ctx.fillStyle = c; ctx.fillRect(px + X * s, py + Y * s, W * s + .5, H * s + .5); };
  R(.2, .2, .6, .6, A);
  if (n) R(.2, 0, .6, .2, A); if (so) R(.2, .8, .6, .2, A); if (e) R(.8, .2, .2, .6, A); if (w) R(0, .2, .2, .6, A);
  if (cnt < 3) { const L = '#e5c95b'; if (n) R(.48, 0, .04, .5, L); if (so) R(.48, .5, .04, .5, L); if (e) R(.5, .48, .5, .04, L); if (w) R(0, .48, .5, .04, L); }
  if ((x + y) % 3 === 0) lit.push(px + s * .1, py + s * .1); // sokak lambası
}
function drawB(b, px, py, s, lit) {
  const d = B[b.k], l = b.l, v = VIS[b.k] || 'home', c = d.col;
  const R = (X, Y, W, H, col) => { ctx.fillStyle = col; ctx.fillRect(px + X * s, py + Y * s, W * s, H * s); };
  const O = (X, Y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px + X * s, py + Y * s, r * s, 0, 6.3); ctx.fill(); };
  const win = (X, Y, W, H, cols, rows) => { for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) R(X + i * W * 2, Y + j * H * 2, W, H, '#93c5fd'); };
  ctx.globalAlpha = b.on ? 1 : .45;
  R(.06, .86, .9, .12, 'rgba(0,0,0,.28)'); // gölge
  if (v === 'home') { // seviye 1 küçük ev, 2 büyük ev, 3 lüks ev + havuz
    const w = .3 + l * .12, x = .5 - w / 2;
    R(x, .42, w, .46, '#efe2c0'); R(x - .04, .28, w + .08, .16, c); R(.46, .68, .1, .2, '#6b4423');
    R(x + .04, .52, .1, .1, '#7dd3fc'); if (l > 1) R(x + w - .14, .52, .1, .1, '#7dd3fc');
    R(0, .9, 1, .1, '#3f9b52'); if (l > 2) R(.06, .74, .14, .1, '#38bdf8');
  } else if (v === 'block') { // kat sayısı seviyeyle artar
    const h = .36 + l * .16;
    R(.18, .9 - h, .64, h, c); R(.14, .86 - h, .72, .06, '#e2e8f0'); win(.26, .96 - h, .1, .07, 3, Math.floor((h - .1) / .14));
  } else if (v === 'tower') {
    const h = .5 + l * .14;
    R(.3, .92 - h, .4, h, c); R(.34, .88 - h, .32, .06, '#cbd5e1'); R(.49, .78 - h, .02, .12, '#e2e8f0');
    win(.36, .98 - h, .07, .05, 2, Math.floor((h - .1) / .1));
  } else if (v === 'shop') {
    R(.1, .42, .8, .46, '#e5e7eb'); R(.1, .36, .8, .12, c); R(.3, .28, .4, .08, '#fbbf24'); R(.44, .64, .12, .24, '#475569');
    R(.16, .55, .2, .14, '#7dd3fc'); R(.64, .55, .2, .14, '#7dd3fc');
  } else if (v === 'fact') {
    R(.08, .5, .84, .38, '#78716c'); R(.08, .44, .84, .08, c); R(.18, .2, .1, .3, '#57534e'); R(.62, .12, .1, .38, '#57534e');
    O(.24, .12, .07, 'rgba(203,213,225,.6)'); O(.7, .05, .08, 'rgba(203,213,225,.5)'); R(.16, .62, .14, .1, '#fde68a');
  } else if (v === 'park') {
    R(0, 0, 1, 1, '#3f9b52'); O(.3, .35, .2, '#166534'); O(.7, .3, .17, '#15803d'); O(.62, .7, .2, '#166534'); R(.12, .78, .26, .06, '#a16207');
  } else if (v === 'civic') {
    R(.1, .36, .8, .52, c); R(.1, .3, .8, .08, '#e2e8f0'); R(.44, .62, .12, .26, '#1e293b'); R(.46, .4, .08, .16, '#fff'); R(.42, .44, .16, .08, '#fff');
    R(.68, .78, .22, .1, '#f8fafc'); R(.72, .74, .12, .06, '#94a3b8');
  } else if (v === 'solar') {
    R(.06, .3, .88, .6, '#1e3a8a'); for (let i = 1; i < 3; i++) R(.06 + i * .29, .3, .02, .6, '#93c5fd'); R(.06, .58, .88, .02, '#93c5fd');
  } else if (v === 'wind') {
    R(.47, .3, .06, .6, '#e2e8f0'); ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = Math.max(1, .04 * s); ctx.beginPath();
    ctx.moveTo(px + .5 * s, py + .3 * s); ctx.lineTo(px + .5 * s, py + .02 * s); ctx.moveTo(px + .5 * s, py + .3 * s); ctx.lineTo(px + .26 * s, py + .44 * s);
    ctx.moveTo(px + .5 * s, py + .3 * s); ctx.lineTo(px + .74 * s, py + .44 * s); ctx.stroke();
  } else if (v === 'water') {
    R(.25, .42, .5, .46, '#0ea5e9'); R(.25, .36, .5, .1, '#7dd3fc'); R(.3, .5, .06, .3, '#38bdf8');
  } else { // bus / metro
    R(.2, .35, .6, .06, c); R(.22, .35, .04, .5, '#64748b'); R(.74, .35, .04, .5, '#64748b'); R(.3, .62, .4, .1, '#f8fafc');
  }
  if (b.on && (v === 'tower' || v === 'block' || v === 'home')) lit.push(px + s * .4, py + s * .5, px + s * .58, py + s * .66);
  const t = view === 'power' ? (d.gen ? 'rgba(250,204,21,.7)' : d.pw ? (st.p >= 1 ? 'rgba(34,197,94,.5)' : 'rgba(239,68,68,.65)') : '')
    : view === 'water' ? (d.wat ? 'rgba(56,189,248,.7)' : d.wt ? (st.w >= 1 ? 'rgba(56,189,248,.45)' : st.w >= .7 ? 'rgba(249,115,22,.6)' : 'rgba(239,68,68,.65)') : '')
    : view === 'pollution' ? (d.pol > 0 ? 'rgba(239,68,68,.65)' : d.pol < 0 ? 'rgba(34,197,94,.5)' : '') : '';
  if (t) R(0, 0, 1, 1, t);
  if (view === 'pollution' && d.pol > 0 && b.on) hz.push(px, py, l);
  ctx.globalAlpha = 1;
}
function setView(v) { view = v; dirty = true; }
function sane(r) { // kayıt doğrulama + sürüm geçişi (v1 → v2)
  if (!r || !Array.isArray(r.g) || r.g.length !== N * N || !Array.isArray(r.ter)) return null;
  r.g = r.g.map(b => (b && B[b.k] ? { k: b.k, l: Math.max(1, Math.min(3, b.l | 0 || 1)) } : null));
  const n = (x, dv) => (Number.isFinite(x) ? x : dv);
  r.money = n(r.money, 5000); r.day = n(r.day, 1); r.t = n(r.t, .4) % 1; r.speed = n(r.speed, 1);
  r.pop = Math.max(0, n(r.pop, 0)); r.hap = Math.min(100, Math.max(0, n(r.hap, 60))); r.tax = Math.min(20, Math.max(0, n(r.tax, 9)));
  r.version = 2; return r;
}
function resize() {
  const r = cv.parentNode.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = r.width * dpr; cv.height = r.height * dpr; dirty = true;
}
function zoomAt(p, nz) {
  nz = Math.max(.4, Math.min(3, nz));
  const k = nz / cam.z;
  cam.x = p.x - (p.x - cam.x) * k; cam.y = p.y - (p.y - cam.y) * k; cam.z = nz; dirty = true;
}

// ===== GİRDİ: dokunma + fare (pointer events) =====
const ptr = new Map();
let drag = null, pin = null;
const P = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const tile = p => ({ x: Math.floor((p.x - cam.x) / (T * cam.z)), y: Math.floor((p.y - cam.y) / (T * cam.z)) });
const paintMode = () => tool === 'del' || (tool === 'build' && sel === 'road');
const mid = () => { const [a, b] = [...ptr.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; };

cv.onpointerdown = e => {
  cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, P(e));
  if (ptr.size === 2) { pin = mid(); drag = null; return; } // iki parmak: zoom + kaydırma
  const p = P(e); hover = tile(p);
  drag = { p, cx: cam.x, cy: cam.y, mv: false, paint: paintMode() };
  if (drag.paint) act(hover, false); // yol/silme: sürükleyerek çiz
  dirty = true;
};
cv.onpointermove = e => {
  const p = P(e);
  if (ptr.has(e.pointerId)) ptr.set(e.pointerId, p);
  if (pin && ptr.size === 2) {
    const n = mid();
    zoomAt(n.m, cam.z * n.d / pin.d); cam.x += n.m.x - pin.m.x; cam.y += n.m.y - pin.m.y; pin = n; return;
  }
  hover = tile(p);
  if (drag) {
    const dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    if (drag.paint) act(hover, true);
    else if (drag.mv || Math.hypot(dx, dy) > 8) { drag.mv = true; cam.x = drag.cx + dx; cam.y = drag.cy + dy; }
  }
  dirty = true;
};
cv.onpointerup = cv.onpointercancel = e => {
  ptr.delete(e.pointerId);
  if (pin) { if (ptr.size < 2) pin = null; drag = null; return; }
  if (drag && !drag.mv && !drag.paint) act(hover, false); // dokunma = seç / yerleştir
  drag = null; dirty = true;
};
cv.onwheel = e => { e.preventDefault(); zoomAt(P(e), cam.z * (e.deltaY < 0 ? 1.12 : .89)); };
document.addEventListener('gesturestart', e => e.preventDefault()); // iOS Safari sayfa zoom'unu engelle
let sy0 = 0;
$('info').addEventListener('touchstart', e => { sy0 = e.touches[0].clientY; }, { passive: true });
$('info').addEventListener('touchend', e => { if (e.changedTouches[0].clientY - sy0 > 50) closeInfo(); }); // aşağı kaydır: kapat
window.addEventListener('pagehide', () => saveGame(true));

// ===== ANA DÖNGÜ =====
function loop(ts) {
  const dt = Math.min(100, ts - last); last = ts;
  if (S.speed > 0) { S.t += dt * S.speed / DAY; if (S.t >= 1) { S.t -= 1; tickDay(); } }
  if (dirty || ts - lastDraw > 250) {
    lastDraw = ts;
    $('date').textContent = 'Gün ' + S.day + ' · ' + String(Math.floor(S.t * 24)).padStart(2, '0') + ':00';
    draw();
  }
  requestAnimationFrame(loop);
}
function initGame() {
  new ResizeObserver(resize).observe(cv.parentNode); resize();
  try { const r = JSON.parse(localStorage.getItem(KEY)); S = sane(r) || undefined; } catch (e) { /* bozuk kayıt */ }
  if (S) { $('hint').remove(); calc(); ui(); tb(); } else newGame();
  cam.z = innerWidth < 800 ? .7 : 1;
  cam.x = (cv.width / dpr - N * T * cam.z) / 2; cam.y = (cv.height / dpr - N * T * cam.z) / 2;
  cards(); requestAnimationFrame(loop);
}
initGame();
