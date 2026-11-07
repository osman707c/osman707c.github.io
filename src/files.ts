// src/files.ts
// Proje dosyası (JSON) dışa / içe aktarma.
import type { Project } from "./types";
import { normalizeProject, uid } from "./project";
import { saveProject } from "./storage";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export async function exportProjectFile(p: Project): Promise<void> {
  const text = JSON.stringify(p, null, 2);
  const base = p.name.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "proje";
  const fileName = `${base}.nashi.json`;
  const file = new File([text], fileName, { type: "application/json" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: p.name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Paylaşım başarısızsa indirmeye düş.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function importProjectFile(file: File): Promise<Project> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Dosya çok büyük. Proje dosyaları 20 MB'tan küçük olmalı.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("Dosya geçerli bir proje dosyası değil.");
  }
  const p = normalizeProject(parsed);
  const now = Date.now();
  const imported: Project = { ...p, id: uid(), createdAt: now, updatedAt: now };
  await saveProject(imported);
  return imported;
}
