// src/media.ts
// Medya içe aktarma: tür tespiti, meta veri, küçük resimler, ses dalga formu.
import type { MediaKind, MediaRecord } from "./types";
import { uid, formatBytes } from "./project";
import { ensureSpace, saveMedia } from "./storage";

export const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_WAVEFORM_BYTES = 100 * 1024 * 1024;
const PEAKS_PER_SEC = 20;

const EXT: Record<string, MediaKind> = {
  mp4: "video", mov: "video", m4v: "video", webm: "video", mkv: "video", avi: "video", "3gp": "video",
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", heic: "image", heif: "image", avif: "image",
  mp3: "audio", m4a: "audio", aac: "audio", wav: "audio", ogg: "audio", flac: "audio", caf: "audio", aiff: "audio",
};

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT[ext] ?? null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function timeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function loadMeta(el: HTMLMediaElement, url: string, unsupported: string): Promise<void> {
  const p = new Promise<void>((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onBad = () => {
      cleanup();
      reject(new Error(unsupported));
    };
    const cleanup = () => {
      el.removeEventListener("loadedmetadata", onOk);
      el.removeEventListener("error", onBad);
    };
    el.addEventListener("loadedmetadata", onOk);
    el.addEventListener("error", onBad);
    el.src = url;
    el.load();
  });
  return timeout(p, 20000, unsupported);
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const p = new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
  return timeout(p, 4000, "seek");
}

async function videoThumbs(video: HTMLVideoElement, duration: number, aspect: number): Promise<string[]> {
  const n = clamp(Math.round(duration / 3), 4, 12);
  const h = 72;
  const w = clamp(Math.round(h * aspect), 40, 160);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    try {
      await seekTo(video, Math.min(Math.max(0, duration - 0.05), ((i + 0.5) * duration) / n));
      if (video.readyState < 2) break;
      ctx.drawImage(video, 0, 0, w, h);
      out.push(canvas.toDataURL("image/jpeg", 0.6));
    } catch {
      break; // küçük resim üretilemezse klip düz renkle gösterilir
    }
  }
  return out;
}

async function probeVideo(file: File, url: string) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "");
  await loadMeta(
    video,
    url,
    "Bu video biçimi tarayıcıda oynatılamıyor. iPhone'da MP4 veya MOV (H.264/HEVC) videoları kullan.",
  );
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0 || video.videoWidth === 0) {
    throw new Error("Video süresi veya boyutu okunamadı. Dosya bozuk ya da desteklenmeyen bir biçimde olabilir.");
  }
  const aspect = video.videoWidth / video.videoHeight;
  const thumbs = await videoThumbs(video, duration, aspect);
  const result = { duration, width: video.videoWidth, height: video.videoHeight, thumbs, thumbAspect: aspect };
  video.removeAttribute("src");
  video.load();
  void file;
  return result;
}

async function probeImage(url: string) {
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Bu görsel biçimi tarayıcıda açılamıyor."));
  });
  img.src = url;
  await timeout(loaded, 20000, "Görsel yüklenemedi.");
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error("Görsel boyutu okunamadı.");
  const th = 96;
  const tw = clamp(Math.round((th * w) / h), 48, 200);
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, tw, th);
  return { duration: 0, width: w, height: h, thumbs: ctx ? [canvas.toDataURL("image/jpeg", 0.7)] : [], thumbAspect: w / h };
}

async function computePeaks(file: File): Promise<Uint8Array | null> {
  if (file.size > MAX_WAVEFORM_BYTES) return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  let ctx: AudioContext | null = null;
  try {
    ctx = new AC();
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const data = buf.getChannelData(0);
    const per = Math.max(1, Math.floor(buf.sampleRate / PEAKS_PER_SEC));
    const bins = Math.ceil(data.length / per);
    const peaks = new Uint8Array(bins);
    let max = 0;
    const raw = new Float32Array(bins);
    for (let b = 0; b < bins; b++) {
      let m = 0;
      const end = Math.min(data.length, (b + 1) * per);
      for (let i = b * per; i < end; i += 4) {
        const v = Math.abs(data[i]);
        if (v > m) m = v;
      }
      raw[b] = m;
      if (m > max) max = m;
    }
    if (max <= 0) return peaks;
    for (let b = 0; b < bins; b++) peaks[b] = Math.round((raw[b] / max) * 255);
    return peaks;
  } catch {
    return null; // dalga formu çıkarılamadı; ses yine de çalınabilir
  } finally {
    void ctx?.close();
  }
}

async function probeAudio(file: File, url: string) {
  const audio = new Audio();
  audio.preload = "metadata";
  await loadMeta(audio, url, "Bu ses biçimi tarayıcıda oynatılamıyor. MP3, M4A veya WAV dene.");
  const duration = audio.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Ses süresi okunamadı.");
  audio.removeAttribute("src");
  audio.load();
  const peaks = await computePeaks(file);
  return { duration, width: 0, height: 0, thumbs: [] as string[], thumbAspect: 1, peaks };
}

/** Dosyayı doğrular, meta verisini çıkarır, IndexedDB'ye kaydeder ve kaydı döndürür. */
export async function importMedia(file: File): Promise<MediaRecord> {
  const kind = kindOf(file);
  if (!kind) {
    throw new Error("Desteklenmeyen dosya türü. Video, fotoğraf veya ses dosyası seç.");
  }
  if (file.size === 0) throw new Error("Dosya boş.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Dosya çok büyük (${formatBytes(file.size)}). En fazla ${formatBytes(MAX_FILE_BYTES)} desteklenir.`);
  }
  await ensureSpace(file.size);

  const url = URL.createObjectURL(file);
  try {
    let info: { duration: number; width: number; height: number; thumbs: string[]; thumbAspect: number; peaks?: Uint8Array | null };
    if (kind === "video") info = await probeVideo(file, url);
    else if (kind === "image") info = await probeImage(url);
    else info = await probeAudio(file, url);

    const rec: MediaRecord = {
      id: uid(),
      name: file.name,
      kind,
      mime: file.type,
      size: file.size,
      duration: info.duration,
      width: info.width,
      height: info.height,
      createdAt: Date.now(),
      blob: file,
      thumbs: info.thumbs,
      thumbAspect: info.thumbAspect,
      peaks: info.peaks ?? null,
      peaksPerSec: PEAKS_PER_SEC,
    };
    await saveMedia(rec);
    return rec;
  } finally {
    URL.revokeObjectURL(url);
  }
}
