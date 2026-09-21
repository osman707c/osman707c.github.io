'use strict';
/* CityForge — veri → simülasyon → çizim → girdi */

// ===== MERKEZİ VERİ =====
const N = 40, T = 32, KEY = 'cityforge1', DAY = 4000;
const TER = ['#2f6f3e', '#1d4ed8', '#24583a'];
const CATS = ['Yol', 'Konut', 'Ticaret', 'Sanayi', 'Kamu', 'Elektrik', 'Su'];
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
};

// ===== DURUM =====
const $ = id => document.getElementById(id);
const cv = $('map'), ctx = cv.getContext('2d');
let S, st = {}, cam = { x: 0, y: 0, z: 1 }, tool = 'select', sel = 'road', cat = 'Yol';
let cur = null, hover = null, dirty = true, last = 0, lastDraw = 0, dpr = 1, snd = true, ac;

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
  let use = 0, gen = 0, wu = 0, wg = 0, cap = 0, jobs = 0, cj = 0, roads = 0, maint = 0;
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
  const traffic = Math.min(1, (S.pop * .25 + jobs * .3) / (roads * 12 + 1));
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
  st = { use, gen, wu, wg, cap, jobs, roads, exp: maint, inc: inc * S.tax / 9, p, w, pol, cov, unemp, traffic };
}

function tickDay() { // her oyun günü: mutluluk, nüfus, ekonomi
  calc();
  const tg = 55 + 25 * st.cov - 25 * (1 - st.p) - 20 * (1 - st.w) - 20 * st.traffic - 30 * st.pol - (S.tax - 9) * 2 - 25 * st.unemp;
  S.hap += (Math.max(0, Math.min(100, tg)) - S.hap) * .3;
  const before = S.pop;
  if (st.cap > S.pop && S.hap > 35 && st.p > .5 && st.unemp < .4) S.pop = Math.min(st.cap, S.pop + Math.ceil((st.cap - S.pop) * .15));
  else if (S.pop > st.cap || S.hap < 20) S.pop = Math.max(0, S.pop - Math.ceil(S.pop * .1));
  const net = Math.round(st.inc - st.exp);
  S.money += net; S.day++;
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
    el.innerHTML = '<h3>Şehir özeti</h3>' + row('Nüfus', f(S.pop) + ' / ' + f(st.cap)) + row('İş', f(st.jobs)) +
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
  try { localStorage.setItem(KEY, JSON.stringify(S)); if (!q) toast('Oyun kaydedildi.'); }
  catch (e) { toast('Kayıt başarısız oldu.'); }
}
function loadGame() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (!r || !r.g) throw 0;
    S = r; cur = null; calc(); ui(); tb(); toast('Oyun yüklendi.');
  } catch (e) { err('Kayıtlı oyun bulunamadı.'); }
}

// ===== ÇİZİM (yalnızca görünen kareler, sadece gerektiğinde) =====
function draw() {
  dirty = false;
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
    if (b.k === 'road') { ctx.fillStyle = d.col; ctx.fillRect(px, py, s + .5, s + .5); continue; }
    ctx.globalAlpha = b.on ? 1 : .4; ctx.fillStyle = d.col; ctx.fillRect(px + m, py + m, s - 2 * m, s - 2 * m); ctx.globalAlpha = 1;
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
  if (nt > .02) {
    ctx.fillStyle = `rgba(5,10,40,${nt})`; ctx.fillRect(0, 0, W, H);
    if (nt > .2) { ctx.fillStyle = '#fde68a'; for (let k = 0; k < lit.length; k += 2) ctx.fillRect(lit[k], lit[k + 1], s * .2, s * .2); }
  }
  if (hover && (tool === 'build' || tool === 'del') && hover.x >= 0 && hover.y >= 0 && hover.x < N && hover.y < N) {
    const i = hover.y * N + hover.x;
    const ok = tool === 'del' ? !!S.g[i] : !S.g[i] && S.ter[i] !== 1 && S.money >= B[sel].cost;
    ctx.fillStyle = ok ? 'rgba(34,197,94,.55)' : 'rgba(239,68,68,.55)'; ctx.fillRect(ox + hover.x * s, oy + hover.y * s, s, s);
  }
  if (cur && tool === 'select') { ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#f5b942'; ctx.strokeRect(ox + cur.x * s, oy + cur.y * s, s, s); }
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
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.g) S = r; } catch (e) { /* bozuk kayıt */ }
  if (S) { $('hint').remove(); calc(); ui(); tb(); } else newGame();
  cam.z = innerWidth < 800 ? .7 : 1;
  cam.x = (cv.width / dpr - N * T * cam.z) / 2; cam.y = (cv.height / dpr - N * T * cam.z) / 2;
  cards(); requestAnimationFrame(loop);
}
initGame();
