// src/components/Editor.tsx
// Düzenleyici kabuğu: üst bar, önizleme alanı, zaman çizelgesi alanı, alt araç çubuğu.
// Faz 1: yalnızca gerçekten çalışan işlevler var (ad, ayarlar, kayıt, yedek).
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Project, ProjectSettings } from "../types";
import { aspectRatio, describeError } from "../project";
import { getProject, saveProject } from "../storage";
import { exportProjectFile } from "../files";
import { Icon, type IconName } from "./icons";
import { RenameSheet, Sheet } from "./ui";
import { SettingsForm } from "./SettingsForm";

type SaveStatus = "saved" | "saving" | "error";
type Panel = "rename" | "settings" | null;

function Tool({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="tool" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function Editor({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);

  const latest = useRef<Project | null>(null);
  const revRef = useRef(0);
  const savedRev = useRef(0);
  const closePanel = useCallback(() => setPanel(null), []);

  useEffect(() => {
    let alive = true;
    getProject(projectId)
      .then((p) => {
        if (!alive) return;
        if (!p) {
          setLoadError("Proje bulunamadı. Silinmiş olabilir.");
          return;
        }
        latest.current = p;
        setProject(p);
      })
      .catch((e) => alive && setLoadError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const flush = useCallback(async () => {
    const p = latest.current;
    const target = revRef.current;
    if (!p || target === savedRev.current) {
      setStatus("saved");
      return;
    }
    setStatus("saving");
    try {
      await saveProject(p);
      savedRev.current = target;
      setSaveError(null);
      setStatus(revRef.current === target ? "saved" : "saving");
    } catch (e) {
      setSaveError(describeError(e));
      setStatus("error");
    }
  }, []);

  const update = useCallback((fn: (p: Project) => Project) => {
    const cur = latest.current;
    if (!cur) return;
    const next = { ...fn(cur), updatedAt: Date.now() };
    latest.current = next;
    revRef.current += 1;
    setProject(next);
    setRev(revRef.current);
    setStatus("saving");
  }, []);

  // Otomatik kayıt: değişiklikten 600 ms sonra.
  useEffect(() => {
    if (rev === 0) return;
    const t = setTimeout(() => void flush(), 600);
    return () => clearTimeout(t);
  }, [rev, flush]);

  // Uygulama arka plana alınırken / sayfa kapanırken bekleyen değişikliği yaz.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  const leave = async () => {
    await flush();
    onClose();
  };

  if (loadError) {
    return (
      <div className="screen">
        <div className="empty fill">
          <Icon name="alert" size={34} />
          <h2>Proje açılamadı</h2>
          <p className="muted">{loadError}</p>
          <button className="btn btn-secondary" onClick={onClose}>
            Projelere dön
          </button>
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="screen">
        <p className="muted center fill">Yükleniyor…</p>
      </div>
    );
  }

  const s = project.settings;
  const statusText = status === "saving" ? "Kaydediliyor…" : status === "error" ? "Kaydedilemedi" : "Kaydedildi";

  return (
    <div className="screen editor">
      <header className="topbar">
        <button className="icon-btn" aria-label="Projelere dön" onClick={() => void leave()}>
          <Icon name="back" />
        </button>
        <button className="title-btn" onClick={() => setPanel("rename")}>
          <strong>{project.name}</strong>
          <small className={status === "error" ? "danger" : ""}>{statusText}</small>
        </button>
        <button className="icon-btn" aria-label="Proje ayarları" onClick={() => setPanel("settings")}>
          <Icon name="tune" />
        </button>
      </header>

      {status === "error" && (
        <div className="notice" role="alert">
          <Icon name="alert" size={20} />
          <div>
            <p>{saveError}</p>
            <button className="link" onClick={() => void flush()}>
              Tekrar dene
            </button>
          </div>
        </div>
      )}

      <main className="stage">
        <div className="frame" style={{ "--ar": aspectRatio(s) } as CSSProperties}>
          <div className="frame-empty">
            <strong>Boş proje</strong>
            <small>
              {s.width} × {s.height}, {s.fps} fps
            </small>
          </div>
        </div>
      </main>

      <section className="timeline" aria-label="Zaman çizelgesi">
        <Icon name="film" size={28} />
        <p className="muted">Henüz klip yok</p>
      </section>

      <nav className="toolbar" aria-label="Araçlar">
        <Tool icon="tune" label="Ayarlar" onClick={() => setPanel("settings")} />
        <Tool icon="check" label="Kaydet" onClick={() => void flush()} />
        <Tool icon="download" label="Yedek" onClick={() => void exportProjectFile(project).catch((e) => setSaveError(describeError(e)))} />
      </nav>

      {panel === "rename" && (
        <RenameSheet
          title="Proje adı"
          initial={project.name}
          onClose={closePanel}
          onSave={(name) => {
            update((p) => ({ ...p, name }));
            setPanel(null);
          }}
        />
      )}

      {panel === "settings" && (
        <Sheet title="Proje ayarları" onClose={closePanel}>
          <SettingsForm value={s} onChange={(settings: ProjectSettings) => update((p) => ({ ...p, settings }))} />
        </Sheet>
      )}
    </div>
  );
}
