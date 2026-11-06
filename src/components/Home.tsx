// src/components/Home.tsx
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Project, ProjectSettings } from "../types";
import { aspectRatio, createProject, defaultSettings, describeError, formatRelative } from "../project";
import { deleteProject, duplicateProject, listProjects, saveProject } from "../storage";
import { exportProjectFile } from "../files";
import { Icon, type IconName } from "./icons";
import { Logo } from "./Logo";
import { ConfirmSheet, RenameSheet, Sheet } from "./ui";
import { SettingsForm } from "./SettingsForm";
import { AppSettings } from "./AppSettings";

type Active =
  | { kind: "new" }
  | { kind: "actions"; project: Project }
  | { kind: "rename"; project: Project }
  | { kind: "delete"; project: Project }
  | { kind: "app" }
  | null;

function NewProjectSheet({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, s: ProjectSettings) => void }) {
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<ProjectSettings>(defaultSettings());
  return (
    <Sheet title="Yeni proje" onClose={onClose}>
      <div className="stack-lg">
        <div className="field">
          <div className="label">Ad</div>
          <input
            className="input"
            value={name}
            placeholder="Adsız proje"
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <SettingsForm value={settings} onChange={setSettings} />
        <button className="btn btn-primary" onClick={() => onCreate(name, settings)}>
          Oluştur
        </button>
      </div>
    </Sheet>
  );
}

function Row({ icon, label, danger, onClick }: { icon: IconName; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`row ${danger ? "danger" : ""}`} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Active>(null);
  const close = useCallback(() => setActive(null), []);

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
      setError(null);
    } catch (e) {
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(describeError(e));
    }
  };

  const create = async (name: string, settings: ProjectSettings) => {
    try {
      const p = createProject(name, settings);
      await saveProject(p);
      setActive(null);
      onOpen(p.id);
    } catch (e) {
      setActive(null);
      setError(describeError(e));
    }
  };

  return (
    <div className="screen">
      <header className="home-head">
        <div className="brand">
          <Logo size={30} />
          <span>Nashi Studio</span>
        </div>
        <button className="icon-btn" aria-label="Ayarlar" onClick={() => setActive({ kind: "app" })}>
          <Icon name="tune" />
        </button>
      </header>

      <main className="home-body">
        <button className="btn btn-primary btn-wide" onClick={() => setActive({ kind: "new" })}>
          <Icon name="plus" size={20} /> Yeni proje
        </button>

        {error && (
          <div className="notice" role="alert">
            <Icon name="alert" size={20} />
            <div>
              <p>{error}</p>
              <button className="link" onClick={() => void refresh()}>
                Tekrar dene
              </button>
            </div>
          </div>
        )}

        {projects === null && !error && <p className="muted center">Yükleniyor…</p>}

        {projects !== null && projects.length === 0 && !error && (
          <div className="empty">
            <Icon name="film" size={34} />
            <h2>Henüz proje yok</h2>
            <p className="muted">Yeni bir proje oluşturup düzenlemeye başla.</p>
          </div>
        )}

        {projects !== null && projects.length > 0 && (
          <section aria-label="Son projeler">
            <h2 className="section">Son projeler</h2>
            <ul className="proj-list">
              {projects.map((p) => (
                <li key={p.id} className="proj">
                  <button className="proj-main" onClick={() => onOpen(p.id)}>
                    <span className="thumb">
                      <i style={{ "--ar": aspectRatio(p.settings) } as CSSProperties} />
                    </span>
                    <span className="proj-text">
                      <strong>{p.name}</strong>
                      <small>
                        {p.settings.aspect === "custom" ? "Özel" : p.settings.aspect}, {p.settings.width} × {p.settings.height}
                      </small>
                      <small>{formatRelative(p.updatedAt)}</small>
                    </span>
                  </button>
                  <button className="icon-btn" aria-label={`${p.name} seçenekleri`} onClick={() => setActive({ kind: "actions", project: p })}>
                    <Icon name="more" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {active?.kind === "new" && <NewProjectSheet onClose={close} onCreate={(n, s) => void create(n, s)} />}

      {active?.kind === "actions" && (
        <Sheet title={active.project.name} onClose={close}>
          <div className="rows">
            <Row icon="edit" label="Yeniden adlandır" onClick={() => setActive({ kind: "rename", project: active.project })} />
            <Row
              icon="copy"
              label="Çoğalt"
              onClick={() => {
                const p = active.project;
                setActive(null);
                void run(() => duplicateProject(p));
              }}
            />
            <Row
              icon="download"
              label="Proje dosyası olarak kaydet"
              onClick={() => {
                const p = active.project;
                setActive(null);
                void run(() => exportProjectFile(p));
              }}
            />
            <Row icon="trash" label="Sil" danger onClick={() => setActive({ kind: "delete", project: active.project })} />
          </div>
        </Sheet>
      )}

      {active?.kind === "rename" && (
        <RenameSheet
          title="Yeniden adlandır"
          initial={active.project.name}
          onClose={close}
          onSave={(name) => {
            const p = { ...active.project, name, updatedAt: Date.now() };
            setActive(null);
            void run(() => saveProject(p));
          }}
        />
      )}

      {active?.kind === "delete" && (
        <ConfirmSheet
          title="Projeyi sil"
          message={`“${active.project.name}” kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
          onClose={close}
          onConfirm={() => {
            const id = active.project.id;
            setActive(null);
            void run(() => deleteProject(id));
          }}
        />
      )}

      {active?.kind === "app" && <AppSettings onClose={close} onImported={() => void refresh()} />}
    </div>
  );
}
