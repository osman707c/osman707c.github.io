// src/components/Editor.tsx
// Düzenleyici: önizleme, zaman çizelgesi, araç çubuğu, medya ve otomatik kayıt.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { MediaRecord, Project, TextStyle, Track } from "../types";
import { aspectRatio, describeError } from "../project";
import { deleteMediaIfUnused, getMediaMany, getProject, saveProject } from "../storage";
import { exportProjectFile } from "../files";
import { importMedia } from "../media";
import { Player } from "../engine";
import {
  MAX_STILL,
  addMedia,
  addText,
  deleteClip,
  duplicateClip,
  findClip,
  moveClip,
  projectDuration,
  removeMediaClips,
  rotateClip,
  setCrop,
  setSpeed,
  splitClip,
  toggleMute,
  trimLeft,
  trimRight,
  updateClip,
} from "../timeline";
import { Icon } from "./icons";
import { ConfirmSheet, RenameSheet, Sheet } from "./ui";
import { SettingsForm } from "./SettingsForm";
import { Timeline, PPS_MAX, PPS_MIN } from "./Timeline";
import { Toolbar, type ClipActions, type Panel } from "./Toolbar";
import { MediaSheet, type ImportState } from "./MediaSheet";

type SaveStatus = "saved" | "saving" | "error";
type SheetId = "rename" | "settings" | "media" | "audio" | "text" | null;
interface Snap {
  tracks: Track[];
}

const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s + 1e-6));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

function TimeLabel({ player, duration }: { player: Player; duration: number }) {
  const [t, setT] = useState(player.t);
  useEffect(() => {
    setT(player.t);
    return player.subscribe(setT);
  }, [player]);
  return (
    <span className="time">
      <b>{fmt(t)}</b> / {fmt(duration)}
    </span>
  );
}

function PlayButton({ playing, disabled, onClick, size = "lg" }: { playing: boolean; disabled?: boolean; onClick: () => void; size?: "lg" | "md" }) {
  return (
    <button className={`play-btn ${size}`} aria-label={playing ? "Duraklat" : "Oynat"} disabled={disabled} onClick={onClick}>
      <Icon name={playing ? "pause" : "play"} size={size === "lg" ? 22 : 20} />
    </button>
  );
}

function FsBar({ player, duration, playing, onClose }: { player: Player; duration: number; playing: boolean; onClose: () => void }) {
  const [t, setT] = useState(player.t);
  useEffect(() => {
    setT(player.t);
    return player.subscribe(setT);
  }, [player]);
  return (
    <>
      <button className="fs-close" aria-label="Tam ekranı kapat" onClick={onClose}>
        <Icon name="shrink" size={20} />
      </button>
      <div className="fs-bar">
        <PlayButton playing={playing} disabled={duration <= 0} onClick={() => player.toggle()} size="md" />
        <input
          type="range"
          min={0}
          max={Math.max(0.01, duration)}
          step={0.01}
          value={Math.min(t, duration)}
          aria-label="Konum"
          onChange={(e) => {
            if (player.playing) player.pause();
            player.seek(Number(e.target.value));
          }}
        />
        <span className="time">
          {fmt(t)} / {fmt(duration)}
        </span>
      </div>
    </>
  );
}

function TextSheet({ onAdd, onClose }: { onAdd: (content: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <Sheet title="Metin ekle" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onAdd(text.trim());
        }}
      >
        <input className="input" value={text} maxLength={120} placeholder="Metnini yaz" autoFocus onChange={(e) => setText(e.target.value)} aria-label="Metin" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
          Ekle
        </button>
      </form>
    </Sheet>
  );
}

export function Editor({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [media, setMedia] = useState<Map<string, MediaRecord>>(new Map());
  const [player, setPlayer] = useState<Player | null>(null);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [pps, setPps] = useState(36);
  const [fs, setFs] = useState(false);
  const [masterMuted, setMasterMuted] = useState(false);
  const [newLayer, setNewLayer] = useState(false);
  const [imp, setImp] = useState<ImportState>({ busy: false, label: "", errors: [] });
  const [confirmRemove, setConfirmRemove] = useState<MediaRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setHistTick] = useState(0);

  const latest = useRef<Project | null>(null);
  const revRef = useRef(0);
  const savedRev = useRef(0);
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const coalesce = useRef<{ key: string; at: number } | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closePanel = useCallback(() => setSheet(null), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  /* ---------- Oynatıcı yaşam döngüsü ---------- */
  useEffect(() => {
    const p = new Player();
    p.onError = (m) => showToast(m);
    const off = p.subscribeState(setPlaying);
    const onHide = () => {
      if (document.visibilityState === "hidden") p.pause();
    };
    document.addEventListener("visibilitychange", onHide);
    setPlayer(p);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      off();
      p.dispose();
      setPlayer(null);
      clearTimeout(toastTimer.current);
    };
  }, [showToast]);

  /* ---------- Proje yükleme ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await getProject(projectId);
        if (!alive) return;
        if (!p) {
          setLoadError("Proje bulunamadı. Silinmiş olabilir.");
          return;
        }
        const recs = await getMediaMany(p.mediaIds);
        if (!alive) return;
        latest.current = p;
        setMedia(new Map(recs.map((r) => [r.id, r])));
        setProject(p);
      } catch (e) {
        if (alive) setLoadError(describeError(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  /* ---------- Otomatik kayıt ---------- */
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

  useEffect(() => {
    if (rev === 0) return;
    const t = setTimeout(() => void flush(), 600);
    return () => clearTimeout(t);
  }, [rev, flush]);

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

  /* ---------- Oynatıcıyı proje ile eşle ---------- */
  const w = project?.settings.width;
  const h = project?.settings.height;
  useEffect(() => {
    if (player && w && h) player.setSize(w, h);
  }, [player, w, h]);
  useEffect(() => {
    player?.setMedia(media);
  }, [player, media]);
  const tracks = project?.tracks;
  useEffect(() => {
    if (!player || !tracks) return;
    player.setTracks(tracks);
    if (pendingSeek.current !== null) {
      player.seek(pendingSeek.current);
      pendingSeek.current = null;
    }
  }, [player, tracks]);
  useEffect(() => {
    player?.setMasterMuted(masterMuted);
  }, [player, masterMuted]);

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => player?.setCanvas(el), [player]);

  // seçili klip silindiyse (geri alma vb.) seçimi bırak
  const found = selectedId && tracks ? findClip(tracks, selectedId) : null;
  useEffect(() => {
    if (selectedId && tracks && !findClip(tracks, selectedId)) {
      setSelectedId(null);
      setPanel(null);
    }
  }, [selectedId, tracks]);

  /* ---------- Geçmiş (geri al / yinele) ---------- */
  const edit = useCallback(
    (fn: (tracks: Track[]) => Track[], key?: string) => {
      const cur = latest.current;
      if (!cur) return;
      const next = fn(cur.tracks);
      if (next === cur.tracks) return;
      const now = Date.now();
      const same = key && coalesce.current && coalesce.current.key === key && now - coalesce.current.at < 900;
      if (!same) {
        past.current.push({ tracks: cur.tracks });
        if (past.current.length > 60) past.current.shift();
      }
      coalesce.current = key ? { key, at: now } : null;
      future.current = [];
      update((p) => ({ ...p, tracks: next }));
      setHistTick((n) => n + 1);
    },
    [update],
  );

  const undo = () => {
    const snap = past.current.pop();
    const cur = latest.current;
    if (!snap || !cur) return;
    future.current.push({ tracks: cur.tracks });
    coalesce.current = null;
    update((p) => ({ ...p, tracks: snap.tracks }));
    setHistTick((n) => n + 1);
  };
  const redo = () => {
    const snap = future.current.pop();
    const cur = latest.current;
    if (!snap || !cur) return;
    past.current.push({ tracks: cur.tracks });
    coalesce.current = null;
    update((p) => ({ ...p, tracks: snap.tracks }));
    setHistTick((n) => n + 1);
  };

  /* ---------- Medya ---------- */
  const importFiles = async (files: File[]) => {
    const errors: string[] = [];
    setImp({ busy: true, label: `Hazırlanıyor 1/${files.length}`, errors: [] });
    for (let i = 0; i < files.length; i++) {
      setImp((s) => ({ ...s, label: `Hazırlanıyor ${i + 1}/${files.length}` }));
      try {
        const rec = await importMedia(files[i]);
        setMedia((prev) => new Map(prev).set(rec.id, rec));
        update((p) => ({ ...p, mediaIds: [...p.mediaIds, rec.id] }));
      } catch (e) {
        errors.push(`${files[i].name}: ${describeError(e)}`);
      }
    }
    setImp({ busy: false, label: "", errors });
  };

  const addToTimeline = (m: MediaRecord) => {
    if (!player) return;
    let start = 0;
    edit((tr) => {
      const r = addMedia(tr, m, player.t, newLayer);
      start = r.start;
      return r.tracks;
    });
    pendingSeek.current = start;
    setSheet(null);
    showToast("Zaman çizelgesine eklendi");
  };

  const removeMedia = (m: MediaRecord) => {
    past.current = [];
    future.current = [];
    update((p) => ({ ...p, tracks: removeMediaClips(p.tracks, m.id), mediaIds: p.mediaIds.filter((x) => x !== m.id) }));
    setMedia((prev) => {
      const n = new Map(prev);
      n.delete(m.id);
      return n;
    });
    setHistTick((n) => n + 1);
    void deleteMediaIfUnused(m.id, projectId);
  };

  const askRemove = (m: MediaRecord) => {
    const used = (latest.current?.tracks ?? []).some((t) => t.clips.some((c) => c.mediaId === m.id));
    if (used) setConfirmRemove(m);
    else removeMedia(m);
  };

  /* ---------- Klip işlemleri ---------- */
  const tracksNow = () => latest.current?.tracks ?? [];
  const maxSourceFor = (id: string): number => {
    const f = findClip(tracksNow(), id);
    const m = f?.clip.mediaId ? media.get(f.clip.mediaId) : undefined;
    return !m || m.kind === "image" ? MAX_STILL : m.duration;
  };

  const act: ClipActions = {
    split: () => {
      if (!selectedId || !player) return;
      const r = splitClip(tracksNow(), selectedId, player.t);
      if (!r) {
        showToast("Bölmek için oynatma çizgisini klibin içine getir");
        return;
      }
      edit(() => r.tracks);
      setSelectedId(r.clipId);
    },
    duplicate: () => {
      if (!selectedId) return;
      const r = duplicateClip(tracksNow(), selectedId);
      if (!r) return;
      edit(() => r.tracks);
      setSelectedId(r.clipId);
    },
    remove: () => {
      if (!selectedId) return;
      edit((tr) => deleteClip(tr, selectedId));
      setSelectedId(null);
      setPanel(null);
    },
    rotate: () => selectedId && edit((tr) => rotateClip(tr, selectedId)),
    setVolume: (v) => selectedId && edit((tr) => updateClip(tr, selectedId, { volume: v }), `vol:${selectedId}`),
    setSpeed: (s) => selectedId && edit((tr) => setSpeed(tr, selectedId, s)),
    setCrop: (c) => selectedId && edit((tr) => setCrop(tr, selectedId, c)),
    trimIn: (v) => selectedId && edit((tr) => trimLeft(tr, selectedId, v), `tin:${selectedId}`),
    trimOut: (v) => selectedId && edit((tr) => trimRight(tr, selectedId, v, maxSourceFor(selectedId)), `tout:${selectedId}`),
    setText: (patch: Partial<TextStyle>) =>
      selectedId &&
      edit((tr) => {
        const f = findClip(tr, selectedId);
        if (!f || !f.clip.text) return tr;
        return updateClip(tr, selectedId, { text: { ...f.clip.text, ...patch } });
      }, `text:${selectedId}`),
  };

  const addTextClip = (content: string) => {
    if (!player) return;
    let id = "";
    edit((tr) => {
      const r = addText(tr, player.t, content);
      id = r.clipId;
      return r.tracks;
    });
    setSheet(null);
    setSelectedId(id);
  };

  const leave = async () => {
    player?.pause();
    await flush();
    onClose();
  };

  /* ---------- Görünüm ---------- */
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
  if (!project || !player) {
    return (
      <div className="screen">
        <p className="muted center fill">Yükleniyor…</p>
      </div>
    );
  }

  const s = project.settings;
  const duration = projectDuration(project.tracks);
  const statusText = status === "saving" ? "Kaydediliyor…" : status === "error" ? "Kaydedilemedi" : "Kaydedildi";
  const selMedia = found?.clip.mediaId ? media.get(found.clip.mediaId) ?? null : null;
  const libItems = [...media.values()].filter((m) => (sheet === "audio" ? m.kind === "audio" : m.kind !== "audio")).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="screen editor">
      <header className="topbar">
        <button className="icon-btn" aria-label="Projelere dön" onClick={() => void leave()}>
          <Icon name="back" />
        </button>
        <button className="title-btn" onClick={() => setSheet("rename")}>
          <strong>{project.name}</strong>
          <small className={status === "error" ? "danger" : ""}>{statusText}</small>
        </button>
        <button className="icon-btn" aria-label="Proje ayarları" onClick={() => setSheet("settings")}>
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

      <main className={`stage${fs ? " fs" : ""}`}>
        <div className="frame" style={{ "--ar": aspectRatio(s) } as CSSProperties}>
          <canvas ref={canvasRef} className="canvas" />
          {duration === 0 && (
            <div className="frame-empty">
              <strong>Boş proje</strong>
              <small>
                {s.width} × {s.height}, {s.fps} fps
              </small>
            </div>
          )}
        </div>
        {!fs && (
          <button className="expand" aria-label="Tam ekran önizleme" onClick={() => setFs(true)}>
            <Icon name="expand" size={16} />
          </button>
        )}
        {fs && <FsBar player={player} duration={duration} playing={playing} onClose={() => setFs(false)} />}
      </main>

      <div className="transport">
        <PlayButton playing={playing} disabled={duration <= 0} onClick={() => player.toggle()} />
        <div className="t-center">
          <button className="mini" aria-label="Geri al" disabled={past.current.length === 0} onClick={undo}>
            <Icon name="undo" size={18} />
          </button>
          <TimeLabel player={player} duration={duration} />
          <button className="mini" aria-label="Yinele" disabled={future.current.length === 0} onClick={redo}>
            <Icon name="redo" size={18} />
          </button>
        </div>
        <div className="t-right">
          <button className="mini" aria-label={masterMuted ? "Önizleme sesini aç" : "Önizleme sesini kapat"} onClick={() => setMasterMuted((m) => !m)}>
            <Icon name={masterMuted ? "volumeOff" : "volume"} size={18} />
          </button>
          <button className="mini" aria-label="Uzaklaştır" disabled={pps <= PPS_MIN} onClick={() => setPps((p) => Math.max(PPS_MIN, p / 1.4))}>
            <Icon name="zoomOut" size={18} />
          </button>
          <button className="mini" aria-label="Yakınlaştır" disabled={pps >= PPS_MAX} onClick={() => setPps((p) => Math.min(PPS_MAX, p * 1.4))}>
            <Icon name="zoomIn" size={18} />
          </button>
        </div>
      </div>

      <Timeline
        player={player}
        tracks={project.tracks}
        media={media}
        selectedId={selectedId}
        pps={pps}
        onSelect={(id) => {
          setSelectedId(id);
          if (!id) setPanel(null);
        }}
        onPps={setPps}
        onMove={(id, trackId, start) => edit((tr) => moveClip(tr, id, trackId, start))}
        onTrimLeft={(id, v) => edit((tr) => trimLeft(tr, id, v))}
        onTrimRight={(id, v) => edit((tr) => trimRight(tr, id, v, maxSourceFor(id)))}
        onToggleMute={(id) => edit((tr) => toggleMute(tr, id))}
      />

      <Toolbar
        clip={found?.clip ?? null}
        media={selMedia}
        panel={panel}
        setPanel={setPanel}
        onBack={() => setSelectedId(null)}
        onOpenMedia={() => setSheet("media")}
        onOpenAudio={() => setSheet("audio")}
        onAddText={() => setSheet("text")}
        act={act}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {sheet === "rename" && (
        <RenameSheet
          title="Proje adı"
          initial={project.name}
          onClose={closePanel}
          onSave={(name) => {
            update((p) => ({ ...p, name }));
            setSheet(null);
          }}
        />
      )}

      {sheet === "settings" && (
        <Sheet title="Proje ayarları" onClose={closePanel}>
          <div className="stack-lg">
            <SettingsForm value={s} onChange={(settings) => update((p) => ({ ...p, settings }))} />
            <button
              className="btn btn-secondary"
              onClick={() => void exportProjectFile(project).catch((e) => showToast(describeError(e)))}
            >
              <Icon name="download" size={20} /> Proje dosyası olarak kaydet
            </button>
            <p className="hint">Proje dosyası medya dosyalarını içermez; yalnızca düzenlemeleri kaydeder.</p>
          </div>
        </Sheet>
      )}

      {(sheet === "media" || sheet === "audio") && (
        <MediaSheet
          title={sheet === "audio" ? "Ses" : "Medya"}
          accept={sheet === "audio" ? "audio/*" : "video/*,image/*"}
          items={libItems}
          import={imp}
          newLayer={newLayer}
          onNewLayer={setNewLayer}
          onImport={(files) => void importFiles(files)}
          onAdd={addToTimeline}
          onRemove={askRemove}
          onClearErrors={() => setImp((i) => ({ ...i, errors: [] }))}
          onClose={closePanel}
        />
      )}

      {sheet === "text" && <TextSheet onAdd={addTextClip} onClose={closePanel} />}

      {confirmRemove && (
        <ConfirmSheet
          title="Medyayı sil"
          message="Bu medya zaman çizelgesinde kullanılıyor. Silersen ilgili klipler de silinir ve geri alınamaz."
          confirmLabel="Sil"
          danger
          onClose={() => setConfirmRemove(null)}
          onConfirm={() => {
            removeMedia(confirmRemove);
            setConfirmRemove(null);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
