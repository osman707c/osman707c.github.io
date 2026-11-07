// src/project.ts
// Saf proje mantığı (arayüzden ve depolamadan bağımsız).
import type { AspectId, Fps, Project, ProjectSettings } from "./types";

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
  };
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
    tracks: Array.isArray(r.tracks) ? (r.tracks as Project["tracks"]) : [],
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
