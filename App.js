const $ = id => document.getElementById(id);
let klipler = [], ff = null, iptal = false;

$('dosya').onchange = async e => {
  klipler = [];
  for (const f of e.target.files) {
    const d = await sure(f);
    klipler.push({ f, d });
  }
  $('liste').innerHTML = klipler.map(k =>
    `<li>${k.f.name} (${k.d.toFixed(1)} sn, ${(k.f.size / 1e6).toFixed(0)} MB)${k.f.size > 2e8 ? ' ⚠️ çok büyük, bellek yetmeyebilir' : ''}</li>`).join('');
};

function sure(f) {
  return new Promise(r => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { r(v.duration || 0); URL.revokeObjectURL(v.src); };
    v.onerror = () => r(0);
    v.src = URL.createObjectURL(f);
  });
}

function promptCoz(t) {
  t = t.toLowerCase();
  const s = { klip: 1.5, hiz: 1, renk: 'normal', vig: false, grain: false, zoom: false, sure: 15, notlar: [] };
  if (/hızlı|hizli|agresif|velocity|tempo|hareketli/.test(t)) { s.klip = 0.8; s.notlar.push('Hızlı kesmeler'); }
  if (/yavaş|yavas|sakin|duygusal/.test(t)) { s.klip = 2.5; s.notlar.push('Uzun planlar'); }
  if (/slow ?motion|ağır çekim/.test(t)) { s.hiz = 0.6; s.notlar.push('Ağır çekim'); }
  else if (/hızlandır|hizlandir/.test(t)) { s.hiz = 1.5; s.notlar.push('Hızlandırma'); }
  if (/sinematik|dizi|peaky|film/.test(t)) { s.renk = 'sinema'; s.vig = s.grain = true; s.notlar.push('Sinematik renk, vignette, grain'); }
  if (/karanlık|karanlik|dark|agresif/.test(t)) { s.renk = 'karanlik'; s.vig = true; s.notlar.push('Karanlık ton, vignette'); }
  if (/zoom|yakınlaş|yakinlas/.test(t)) { s.zoom = true; s.notlar.push('Yakınlaştırma'); }
  const m = t.match(/(\d+)\s*(sn|saniye)/);
  if (m) s.sure = Math.min(60, +m[1]);
  return s;
}

function planYap(s) {
  const n = Math.ceil(s.sure / s.klip), sayac = klipler.map(() => 0);
  const per = Math.ceil(n / klipler.length), plan = [];
  for (let k = 0; k < n; k++) {
    const i = k % klipler.length, d = klipler[i].d;
    const len = Math.min(s.klip * s.hiz, d);
    const adim = per > 1 ? Math.max(0, (d - len) / (per - 1)) : 0;
    const start = Math.min(sayac[i]++ * adim, Math.max(0, d - len));
    plan.push({ i, start, len });
  }
  return plan;
}

function boyut() {
  const [a, b] = $('oran').value.split(':').map(Number), k = +$('cozunurluk').value;
  const cift = x => Math.round(x / 2) * 2;
  return a < b ? [cift(k), cift(k * b / a)] : a > b ? [cift(k * a / b), cift(k)] : [cift(k), cift(k)];
}

function planGoster() {
  if (!klipler.length) { $('plan').textContent = 'Önce en az bir video yükle.'; return null; }
  const s = promptCoz($('prompt').value), plan = planYap(s);
  $('plan').textContent = `Analiz: kural tabanlı (AI değil)\n` +
    `Stil: ${s.notlar.join(', ') || 'Düz kesme'}\nParça: ${plan.length} x ${s.klip} sn (~${s.sure} sn)\n` +
    plan.map((p, k) => `${k + 1}. klip ${p.i + 1} @ ${p.start.toFixed(1)} sn`).join('\n');
  return { s, plan };
}
$('planBtn').onclick = planGoster;

function filtre(s, W, H) {
  const z = s.zoom ? 1.2 : 1, e = x => Math.round(x / 2) * 2;
  let f = [`fps=30`, `setpts=(PTS-STARTPTS)/${s.hiz}`,
    `scale=${e(W * z)}:${e(H * z)}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`];
  if (s.renk === 'sinema') f.push('eq=contrast=1.15:saturation=0.85:gamma_b=1.08', 'colorbalance=rs=0.08:bs=-0.06');
  if (s.renk === 'karanlik') f.push('eq=brightness=-0.07:contrast=1.25:saturation=0.75');
  if (s.vig) f.push('vignette=PI/5');
  if (s.grain) f.push('noise=alls=10:allf=t');
  f.push('setsar=1', 'format=yuv420p');
  return f.join(',');
}

$('iptal').onclick = () => { iptal = true; try { ff && ff.exit(); } catch (e) {} ff = null; };

$('baslat').onclick = async () => {
  const p = planGoster(); if (!p) return;
  const { s, plan } = p, [W, H] = boyut();
  iptal = false;
  ['baslat'].forEach(i => $(i).hidden = true);
  $('iptal').hidden = false; $('ilerleme').hidden = false;
  ['onizleme', 'indir', 'paylas'].forEach(i => $(i).hidden = true);
  try {
    $('durum').textContent = 'FFmpeg yükleniyor (ilk seferde ~30 MB)...';
    if (!ff) {
      ff = FFmpeg.createFFmpeg({ corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js' });
      await ff.load();
    }
    let akt = 0;
    ff.setProgress(({ ratio }) => { $('ilerleme').value = (akt + Math.min(1, Math.max(0, ratio))) / plan.length; });
    for (let i = 0; i < klipler.length; i++)
      ff.FS('writeFile', `in${i}`, await FFmpeg.fetchFile(klipler[i].f));
    for (let k = 0; k < plan.length; k++) {
      akt = k;
      $('durum').textContent = `Parça ${k + 1}/${plan.length} işleniyor...`;
      const q = plan[k];
      await ff.run('-ss', String(q.start), '-t', String(q.len), '-i', `in${q.i}`,
        '-vf', filtre(s, W, H), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', `s${k}.mp4`);
    }
    $('durum').textContent = 'Birleştiriliyor...';
    ff.FS('writeFile', 'liste.txt', plan.map((_, k) => `file 's${k}.mp4'`).join('\n'));
    await ff.run('-f', 'concat', '-safe', '0', '-i', 'liste.txt', '-c', 'copy', 'cikti.mp4');
    const data = ff.FS('readFile', 'cikti.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' }), url = URL.createObjectURL(blob);
    $('onizleme').src = url; $('indir').href = url;
    ['onizleme', 'indir', 'paylas'].forEach(i => $(i).hidden = false);
    $('paylas').onclick = async () => {
      const file = new File([blob], 'edit.mp4', { type: 'video/mp4' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
      else alert('Bu tarayıcı paylaşımı desteklemiyor. İndir düğmesini kullan.');
    };
    $('durum').textContent = 'Hazır ✅';
    for (let i = 0; i < klipler.length; i++) ff.FS('unlink', `in${i}`);
    plan.forEach((_, k) => ff.FS('unlink', `s${k}.mp4`));
    ff.FS('unlink', 'cikti.mp4');
  } catch (err) {
    console.error(err);
    ff = null;
    $('durum').textContent = iptal ? 'İşlem iptal edildi.'
      : 'Dışa aktarma başarısız. Büyük olasılıkla bellek yetmedi. Daha az/kısa video, 480p ve daha kısa süre dene.';
  }
  $('baslat').hidden = false; $('iptal').hidden = true; $('ilerleme').hidden = true;
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
