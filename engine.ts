// src/engine.ts
// Oynatma motoru: zaman çizelgesini tek bir tuvale birleştirir ve sesi karıştırır.
// - Görüntü: canvas (tüm katmanlar aynı kompozisyon kurallarıyla çizilir)
// - Ses: Web Audio (iPhone'da <video>.volume çalışmadığı için ses seviyesi GainNode ile ayarlanır)
// - Kaynaklar: sabit boyutlu <video> havuzu; ihtiyaç olunca klipe atanır, gereksiz bellek tutulmaz.
import type { Clip, MediaRecord, Track } from "./types";
import { clipEnd, projectDuration } from "./timeline";

const POOL_SIZE = 4;
const LOOKAHEAD = 1.5; // saniye: sıradaki klip önceden yüklenir
const MAX_CANVAS = 960; // önizleme tuvalinin en uzun kenarı
// iOS'ta öğeyi kullanıcı dokunuşuyla "açmak" için kullanılan boş ses dosyası
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

interface Slot {
  el: HTMLVideoElement;
  gain: GainNode | null;
  clipId: string | null;
  src: string;
}

type Listener = (t: number) => void;

export class Player {
  t = 0;
  playing = false;
  masterMuted = false;
  onError: ((message: string) => void) | null = null;

  private tracks: Track[] = [];
  private media = new Map<string, MediaRecord>();
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private outW = 540;
  private outH = 960;
  private slots: Slot[] = [];
  private host: HTMLDivElement;
  private urls = new Map<string, string>();
  private imgs = new Map<string, HTMLImageElement>();
  private thumbImgs = new Map<string, HTMLImageElement[]>();
  private audio: AudioContext | null = null;
  private unlocked = false;
  private raf = 0;
  private last = 0;
  private holdMs = 0;
  private drawQueued = false;
  private disposed = false;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<(playing: boolean) => void>();

  constructor() {
    this.host = document.createElement("div");
    this.host.setAttribute("aria-hidden", "true");
    this.host.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;overflow:hidden;";
    document.body.appendChild(this.host);
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement("video");
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.preload = "auto";
      const slot: Slot = { el, gain: null, clipId: null, src: "" };
      el.addEventListener("seeked", () => this.requestDraw());
      el.addEventListener("loadeddata", () => this.requestDraw());
      el.addEventListener("error", () => {
        if (slot.src && slot.src !== SILENT_WAV && slot.clipId) this.onError?.("Bir klip oynatılamadı. Medya dosyası bozuk olabilir.");
      });
      this.host.appendChild(el);
      this.slots.push(slot);
    }
  }

  /* ---------- Dış arayüz ---------- */

  setCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx2d = canvas ? canvas.getContext("2d") : null;
    this.applySize();
    this.requestDraw();
  }

  setSize(width: number, height: number) {
    const scale = Math.min(1, MAX_CANVAS / Math.max(width, height));
    this.outW = Math.max(2, Math.round(width * scale));
    this.outH = Math.max(2, Math.round(height * scale));
    this.applySize();
    this.requestDraw();
  }

  setMedia(media: Map<string, MediaRecord>) {
    this.media = media;
    // artık var olmayan medyanın bağlantılarını bırak
    for (const [id, url] of this.urls) {
      if (!media.has(id)) {
        URL.revokeObjectURL(url);
        this.urls.delete(id);
        this.imgs.delete(id);
        this.thumbImgs.delete(id);
        for (const s of this.slots) if (s.src === url) this.releaseSlot(s);
      }
    }
    this.sync();
    this.requestDraw();
  }

  setTracks(tracks: Track[]) {
    this.tracks = tracks;
    const d = this.duration();
    if (this.t > d) this.t = d;
    this.sync();
    this.requestDraw();
    this.emit();
  }

  setMasterMuted(m: boolean) {
    this.masterMuted = m;
    this.sync();
  }

  duration(): number {
    return projectDuration(this.tracks);
  }

  seek(t: number) {
    this.t = Math.min(Math.max(0, t), this.duration());
    this.sync();
    this.requestDraw();
    this.emit();
  }

  play() {
    if (this.playing || this.disposed) return;
    const d = this.duration();
    if (d <= 0) return;
    if (this.t >= d - 0.05) this.t = 0;
    this.unlock(); // dokunuş olayının içinde çalışmalı
    this.playing = true;
    this.last = performance.now();
    this.holdMs = 0;
    this.sync();
    this.stateEmit();
    this.raf = requestAnimationFrame(this.loop);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const s of this.slots) if (!s.el.paused) s.el.pause();
    this.stateEmit();
    this.requestDraw();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  subscribeState(fn: (playing: boolean) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.playing = false;
    for (const s of this.slots) {
      s.el.pause();
      s.el.removeAttribute("src");
      s.el.load();
      try {
        s.gain?.disconnect();
      } catch {
        /* yoksay */
      }
    }
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.imgs.clear();
    this.thumbImgs.clear();
    this.host.remove();
    void this.audio?.close().catch(() => undefined);
    this.listeners.clear();
    this.stateListeners.clear();
  }

  /* ---------- İç işleyiş ---------- */

  private applySize() {
    if (!this.canvas) return;
    if (this.canvas.width !== this.outW) this.canvas.width = this.outW;
    if (this.canvas.height !== this.outH) this.canvas.height = this.outH;
  }

  private emit() {
    for (const fn of this.listeners) fn(this.t);
  }

  private stateEmit() {
    for (const fn of this.stateListeners) fn(this.playing);
  }

  private url(mediaId: string): string | null {
    const cached = this.urls.get(mediaId);
    if (cached) return cached;
    const m = this.media.get(mediaId);
    if (!m) return null;
    const url = URL.createObjectURL(m.blob);
    this.urls.set(mediaId, url);
    return url;
  }

  private isActive(c: Clip): boolean {
    return this.t >= c.start && this.t < clipEnd(c);
  }

  private srcTime(c: Clip): number {
    const raw = c.sourceIn + (this.t - c.start) * c.speed;
    return Math.min(Math.max(c.sourceIn, raw), Math.max(c.sourceIn, c.sourceOut - 0.02));
  }

  private unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback"; // sessiz modda da çal
    } catch {
      /* yoksay */
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      try {
        this.audio = new AC();
      } catch {
        this.audio = null;
      }
    }
    for (const s of this.slots) {
      if (!s.src) {
        s.el.src = SILENT_WAV;
        s.src = SILENT_WAV;
      }
      const p = s.el.play(); // kullanıcı dokunuşu içinde: öğeyi sonradan programla çalabilmek için
      s.el.pause();
      if (p) p.catch(() => undefined);
      if (this.audio) {
        try {
          const node = this.audio.createMediaElementSource(s.el);
          const g = this.audio.createGain();
          node.connect(g);
          g.connect(this.audio.destination);
          s.gain = g;
        } catch {
          s.gain = null;
        }
      }
    }
    void this.audio?.resume().catch(() => undefined);
  }

  private releaseSlot(s: Slot) {
    if (!s.el.paused) s.el.pause();
    s.clipId = null;
  }

  /** Hangi klipler hangi video öğesine atanacak, hangileri çalacak/bekleyecek. */
  private sync() {
    const wanted: { clip: Clip; track: Track }[] = [];
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        if (!clip.mediaId) continue;
        const m = this.media.get(clip.mediaId);
        if (!m || m.kind === "image") continue;
        if (clip.start - LOOKAHEAD <= this.t && this.t < clipEnd(clip) + 0.05) wanted.push({ clip, track });
      }
    }
    wanted.sort((a, b) => {
      const pa = this.isActive(a.clip) ? 0 : 1;
      const pb = this.isActive(b.clip) ? 0 : 1;
      return pa - pb || a.clip.start - b.clip.start;
    });
    const keep = wanted.slice(0, POOL_SIZE);
    const keepIds = new Set(keep.map((w) => w.clip.id));
    for (const s of this.slots) if (s.clipId && !keepIds.has(s.clipId)) this.releaseSlot(s);

    for (const { clip, track } of keep) {
      let slot = this.slots.find((s) => s.clipId === clip.id);
      if (!slot) {
        slot = this.slots.find((s) => s.clipId === null);
        if (!slot) continue;
        slot.clipId = clip.id;
        const url = this.url(clip.mediaId as string);
        if (url && slot.src !== url) {
          slot.el.src = url;
          slot.src = url;
        }
        try {
          slot.el.currentTime = this.srcTime(clip);
        } catch {
          /* metadata henüz yok */
        }
      }
      this.applyAV(slot, clip, track);
    }
  }

  private applyAV(s: Slot, clip: Clip, track: Track) {
    const el = s.el;
    const active = this.isActive(clip);
    const want = this.srcTime(clip);
    const speed = Math.min(16, Math.max(0.0625, clip.speed));
    if (el.playbackRate !== speed) el.playbackRate = speed;
    const vol = this.masterMuted || track.muted ? 0 : clip.volume;
    if (s.gain) s.gain.gain.value = vol;
    else el.volume = Math.min(1, vol);

    if (active && this.playing) {
      if (el.paused) {
        if (Math.abs(el.currentTime - want) > 0.05) el.currentTime = want;
        el.play().catch(() => this.onError?.("Oynatma başlatılamadı. Ekrana bir kez dokunup tekrar dene."));
      } else if (Math.abs(el.currentTime - want) > 0.3) {
        el.currentTime = want;
      }
    } else {
      if (!el.paused) el.pause();
      const target = active ? want : clip.sourceIn;
      if (!el.seeking && Math.abs(el.currentTime - target) > 0.03) {
        try {
          el.currentTime = target;
        } catch {
          /* yoksay */
        }
      }
    }
  }

  private loop = (now: number) => {
    if (!this.playing || this.disposed) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;

    // Bir video tamponlanıyorsa saati kısa süre beklet: ses/görüntü kaymasın.
    let stalled = false;
    for (const s of this.slots) {
      if (!s.clipId) continue;
      const found = this.findClip(s.clipId);
      if (found && this.isActive(found) && s.el.readyState < 2 && s.src !== SILENT_WAV) stalled = true;
    }
    if (!stalled) this.holdMs = 0;
    if (stalled && this.holdMs < 1500) this.holdMs += dt * 1000;
    else this.t += dt;

    const d = this.duration();
    if (this.t >= d) {
      this.t = d;
      this.sync();
      this.draw();
      this.emit();
      this.pause();
      return;
    }
    this.sync();
    this.draw();
    this.emit();
    this.raf = requestAnimationFrame(this.loop);
  };

  private findClip(id: string): Clip | null {
    for (const t of this.tracks) for (const c of t.clips) if (c.id === id) return c;
    return null;
  }

  private requestDraw() {
    if (this.drawQueued || this.playing || this.disposed) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.draw();
    });
  }

  private imageFor(mediaId: string): HTMLImageElement | null {
    let img = this.imgs.get(mediaId);
    if (!img) {
      const url = this.url(mediaId);
      if (!url) return null;
      img = new Image();
      img.onload = () => this.requestDraw();
      img.src = url;
      this.imgs.set(mediaId, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }

  private thumbFor(m: MediaRecord, srcTime: number): HTMLImageElement | null {
    if (m.thumbs.length === 0) return null;
    let list = this.thumbImgs.get(m.id);
    if (!list) {
      list = m.thumbs.map((u) => {
        const im = new Image();
        im.onload = () => this.requestDraw();
        im.src = u;
        return im;
      });
      this.thumbImgs.set(m.id, list);
    }
    const idx = Math.min(list.length - 1, Math.max(0, Math.floor((srcTime / Math.max(0.01, m.duration)) * list.length)));
    const im = list[idx];
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  private draw() {
    const ctx = this.ctx2d;
    if (!ctx || !this.canvas) return;
    const W = this.outW;
    const H = this.outH;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const track = this.tracks[i];
      if (!track.visible || track.kind === "audio") continue;
      for (const clip of track.clips) {
        if (!this.isActive(clip)) continue;
        if (clip.text) {
          this.drawText(ctx, clip, W, H);
          continue;
        }
        const m = clip.mediaId ? this.media.get(clip.mediaId) : undefined;
        if (!m) continue;
        if (m.kind === "image") {
          const img = this.imageFor(m.id);
          if (img) this.drawMedia(ctx, img, img.naturalWidth, img.naturalHeight, clip, W, H);
        } else if (m.kind === "video") {
          const slot = this.slots.find((s) => s.clipId === clip.id);
          const el = slot?.el;
          if (el && slot && slot.src !== SILENT_WAV && el.readyState >= 2 && el.videoWidth > 0) {
            this.drawMedia(ctx, el, el.videoWidth, el.videoHeight, clip, W, H);
          } else {
            const th = this.thumbFor(m, this.srcTime(clip));
            if (th) this.drawMedia(ctx, th, th.naturalWidth, th.naturalHeight, clip, W, H);
          }
        }
      }
    }
  }

  private drawMedia(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, clip: Clip, W: number, H: number) {
    let sx = 0;
    let sy = 0;
    let cw = sw;
    let ch = sh;
    if (clip.crop !== "none") {
      const [a, b] = clip.crop.split(":").map(Number);
      const ar = a / b;
      if (sw / sh > ar) {
        cw = sh * ar;
        sx = (sw - cw) / 2;
      } else {
        ch = sw / ar;
        sy = (sh - ch) / 2;
      }
    }
    const swap = clip.rotation === 90 || clip.rotation === 270;
    const dw = swap ? ch : cw;
    const dh = swap ? cw : ch;
    const scale = Math.min(W / dw, H / dh);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate((clip.rotation * Math.PI) / 180);
    ctx.drawImage(src, sx, sy, cw, ch, (-cw * scale) / 2, (-ch * scale) / 2, cw * scale, ch * scale);
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D, clip: Clip, W: number, H: number) {
    const t = clip.text;
    if (!t) return;
    const size = Math.max(10, Math.round(H * t.size));
    ctx.save();
    ctx.font = `700 ${size}px -apple-system, "SF Pro Display", system-ui, "Helvetica Neue", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = t.color;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = size * 0.12;
    const maxW = W * 0.88;
    const lines: string[] = [];
    for (const para of t.content.split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > maxW) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      lines.push(line);
    }
    const lh = size * 1.2;
    const y0 = H / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh, maxW));
    ctx.restore();
  }
}
