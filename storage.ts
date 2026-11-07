// src/storage.ts
// IndexedDB depolama katmanı. Büyük medya dosyaları ASLA localStorage'a yazılmaz.
import type { MediaRecord, Project } from "./types";
import { normalizeProject, uid, formatBytes } from "./project";

const DB_NAME = "nashi-studio";
const PROJECTS = "projects";
const MEDIA = "media";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Bu tarayıcı IndexedDB desteklemiyor. Özel gezinme kapalı olmalı."));
        return;
      }
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA, { keyPath: "id" });
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("Veritabanı açılamadı."));
      };
      req.onblocked = () => {
        dbPromise = null;
        reject(new Error("Veritabanı başka bir sekme tarafından kilitlendi. Diğer Nashi Studio sekmelerini kapat."));
      };
    });
  }
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error("Depolama işlemi başarısız."));
    tx.onabort = () => reject(tx.error ?? new Error("Depolama işlemi iptal edildi."));
  });
}

/* ---------- Projeler ---------- */

export async function listProjects(): Promise<Project[]> {
  const all = await run<unknown[]>(PROJECTS, "readonly", (s) => s.getAll());
  const out: Project[] = [];
  for (const raw of all) {
    try {
      out.push(normalizeProject(raw));
    } catch {
      // Bozuk kayıt listeyi bozmasın; atla.
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const raw = await run<unknown>(PROJECTS, "readonly", (s) => s.get(id));
  return raw ? normalizeProject(raw) : undefined;
}

export async function saveProject(p: Project): Promise<void> {
  await run(PROJECTS, "readwrite", (s) => s.put(p));
}

/** Projeyi siler; başka hiçbir projenin kullanmadığı medya dosyalarını da temizler. */
export async function deleteProject(id: string): Promise<void> {
  const projects = await listProjects();
  const target = projects.find((p) => p.id === id);
  if (target) {
    const used = new Set(projects.filter((p) => p.id !== id).flatMap((p) => p.mediaIds));
    for (const mid of target.mediaIds) if (!used.has(mid)) await deleteMedia(mid);
  }
  await run(PROJECTS, "readwrite", (s) => s.delete(id));
}

export async function duplicateProject(p: Project): Promise<Project> {
  const now = Date.now();
  const copy: Project = {
    ...(JSON.parse(JSON.stringify(p)) as Project),
    id: uid(),
    name: `${p.name} kopyası`,
    createdAt: now,
    updatedAt: now,
  };
  await saveProject(copy); // medya kayıtları paylaşılır, kopyalanmaz
  return copy;
}

/* ---------- Medya ---------- */

export async function saveMedia(m: MediaRecord): Promise<void> {
  await run(MEDIA, "readwrite", (s) => s.put(m));
}

export async function getMediaMany(ids: string[]): Promise<MediaRecord[]> {
  const out: MediaRecord[] = [];
  for (const id of ids) {
    const rec = await run<MediaRecord | undefined>(MEDIA, "readonly", (s) => s.get(id));
    if (rec) out.push(rec);
  }
  return out;
}

export async function deleteMedia(id: string): Promise<void> {
  await run(MEDIA, "readwrite", (s) => s.delete(id));
}

/** Başka bir proje kullanmıyorsa medya kaydını siler. */
export async function deleteMediaIfUnused(id: string, currentProjectId: string): Promise<void> {
  const projects = await listProjects();
  if (projects.some((p) => p.id !== currentProjectId && p.mediaIds.includes(id))) return;
  await deleteMedia(id);
}

/** Dosyayı kaydetmeden önce yeterli yer olup olmadığını kontrol eder. */
export async function ensureSpace(bytes: number): Promise<void> {
  if (!navigator.storage?.estimate) return;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  if (quota > 0 && usage + bytes * 1.15 > quota) {
    throw new Error(
      `Yeterli depolama alanı yok (dosya ${formatBytes(bytes)}, boş alan ${formatBytes(Math.max(0, quota - usage))}). ` +
        "Kullanılmayan projeleri veya medyayı silip tekrar dene.",
    );
  }
}

/* ---------- Depolama bilgisi ---------- */

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}

export async function requestPersist(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}
