// src/project.ts
// Saf proje mantığı (arayüzden ve depolamadan bağımsız).
import type { AspectId, Clip, Fps, Project, ProjectSettings, Track } from "./types";

export const MIN_SIZE = 240;
export const MAX_SIZE = 4096;
export const FPS_OPTIONS: Fps[] = [24, 30, 60];

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function clampSize(n: number): number {
  const v = Math.round(n);
  if (!Number.isFinite(v)) return 1080;
  const even = v - (v % 2);
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, even));
}

const even = (n: number) => Math.round(n / 2) * 2;

/** Hazır en-boy oranları için piksel boyutu. "custom" için null döner. */
export function presetSize(aspect: AspectId, short: number): { width: number; height: number } | null {
  switch (aspect) {
    case "9:16":
      return { width: short, height: even((short * 16) / 9) };
    case "16:9":
      return { width: even((short * 16) / 9), height: short };
    case "1:1":
      return { width: short, height: short };
    default:
      return null;
  }
}

export function defaultSettings(): ProjectSettings {
  return { aspect: "9:16", width: 1080, height: 1920, fps: 30 };
}

export function createProject(name: string, settings: ProjectSettings): Project {
  const now = Date.now();
  return {
    schema: 1,
    id: uid(),
    name: name.trim() || "Adsız proje",
    createdAt: now,
    updatedAt: now,
    settings: { ...settings },
    tracks: [],
    mediaIds: [],
  };
}

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

function normalizeClip(raw: unknown, trackId: string): Clip | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const duration = num(c.duration, 0);
  if (duration <= 0) return null;
  const rot = num(c.rotation, 0);
  const text = c.text as Record<string, unknown> | null | undefined;
  return {
    id: typeof c.id === "string" && c.id ? c.id : uid(),
    trackId,
    mediaId: typeof c.mediaId === "string" ? c.mediaId : null,
    start: Math.max(0, num(c.start, 0)),
    duration,
    sourceIn: Math.max(0, num(c.sourceIn, 0)),
    sourceOut: num(c.sourceOut, duration),
    speed: Math.min(8, Math.max(0.1, num(c.speed, 1))),
    volume: Math.min(2, Math.max(0, num(c.volume, 1))),
    rotation: (rot === 90 || rot === 180 || rot === 270 ? rot : 0) as Clip["rotation"],
    crop: (["1:1", "4:5", "16:9", "9:16"].includes(c.crop as string) ? c.crop : "none") as Clip["crop"],
    text:
      text && typeof text === "object" && typeof text.content === "string"
        ? { content: text.content, size: num(text.size, 0.08), color: typeof text.color === "string" ? text.color : "#ffffff" }
        : null,
    effects: Array.isArray(c.effects) ? (c.effects as Clip["effects"]) : [],
    keyframes: Array.isArray(c.keyframes) ? (c.keyframes as Clip["keyframes"]) : [],
  };
}

function normalizeTracks(raw: unknown): Track[] {
  if (!Array.isArray(raw)) return [];
  const out: Track[] = [];
  for (const t of raw) {
    if (typeof t !== "object" || t === null) continue;
    const r = t as Record<string, unknown>;
    const kind = r.kind === "audio" || r.kind === "text" || r.kind === "image" ? r.kind : "video";
    const id = typeof r.id === "string" && r.id ? r.id : uid();
    const clips = (Array.isArray(r.clips) ? r.clips : [])
      .map((c) => normalizeClip(c, id))
      .filter((c): c is Clip => c !== null);
    out.push({
      id,
      kind,
      name: typeof r.name === "string" ? r.name : kind,
      locked: r.locked === true,
      visible: r.visible !== false,
      muted: r.muted === true,
      clips,
    });
  }
  return out;
}

/** Dışarıdan gelen (JSON içe aktarma / eski kayıt) veriyi doğrular. Geçersizse Error fırlatır. */
export function normalizeProject(raw: unknown): Project {
  const fail = (): never => {
    throw new Error("Proje dosyası geçersiz veya bozuk.");
  };
  if (typeof raw !== "object" || raw === null) return fail();
  const r = raw as Record<string, unknown>;
  const s = r.settings as Record<string, unknown> | undefined;
  if (typeof r.name !== "string" || typeof s !== "object" || s === null) return fail();
  const width = Number(s.width);
  const height = Number(s.height);
  const fps = Number(s.fps);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return fail();
  if (!FPS_OPTIONS.includes(fps as Fps)) return fail();
  const aspect: AspectId =
    s.aspect === "9:16" || s.aspect === "16:9" || s.aspect === "1:1" ? s.aspect : "custom";
  const now = Date.now();
  return {
    schema: 1,
    id: typeof r.id === "string" && r.id ? r.id : uid(),
    name: r.name.trim() || "Adsız proje",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : now,
    settings: { aspect, width: clampSize(width), height: clampSize(height), fps: fps as Fps },
    tracks: normalizeTracks(r.tracks),
    mediaIds: Array.isArray(r.mediaIds) ? r.mediaIds.filter((x): x is string => typeof x === "string") : [],
  };
}

export function aspectRatio(s: ProjectSettings): number {
  return s.width / s.height;
}

export function formatRelative(ts: number): string {
  const diff = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });
  if (abs < 45) return "az önce";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(ts).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function describeError(e: unknown): string {
  if (e instanceof DOMException && e.name === "QuotaExceededError") {
    return "Depolama alanı dolu. Yer açmak için kullanılmayan projeleri sil.";
  }
  if (e instanceof Error && e.message) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
