// src/storage.ts
// IndexedDB depolama katmanı. Büyük medya dosyaları ASLA localStorage'a yazılmaz.
import type { Project } from "./types";
import { normalizeProject, uid } from "./project";

const DB_NAME = "nashi-studio";
const STORE = "projects";
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Bu tarayıcı IndexedDB desteklemiyor. Özel gezinme kapalı olmalı."));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error("Veritabanı açılamadı."));
      };
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? new Error("Depolama işlemi başarısız."));
    tx.onabort = () => reject(tx.error ?? new Error("Depolama işlemi iptal edildi."));
  });
}

export async function listProjects(): Promise<Project[]> {
  const all = await run<unknown[]>("readonly", (s) => s.getAll());
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
  const raw = await run<unknown>("readonly", (s) => s.get(id));
  return raw ? normalizeProject(raw) : undefined;
}

export async function saveProject(p: Project): Promise<void> {
  await run("readwrite", (s) => s.put(p));
}

export async function deleteProject(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
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
  await saveProject(copy);
  return copy;
}

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
