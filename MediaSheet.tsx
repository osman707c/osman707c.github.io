// src/components/MediaSheet.tsx
// Medya kitaplığı: içe aktar, bilgileri gör, zaman çizelgesine ekle, sil.
import { useRef } from "react";
import type { MediaRecord } from "../types";
import { formatBytes } from "../project";
import { Icon } from "./icons";
import { Sheet } from "./ui";

export interface ImportState {
  busy: boolean;
  label: string;
  errors: string[];
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function meta(m: MediaRecord): string {
  const parts: string[] = [];
  if (m.kind !== "image") parts.push(fmt(m.duration));
  if (m.width > 0) parts.push(`${m.width} × ${m.height}`);
  parts.push(formatBytes(m.size));
  return parts.join(", ");
}

export function MediaSheet({
  title,
  accept,
  items,
  import: imp,
  newLayer,
  onNewLayer,
  onImport,
  onAdd,
  onRemove,
  onClearErrors,
  onClose,
}: {
  title: string;
  accept: string;
  items: MediaRecord[];
  import: ImportState;
  newLayer: boolean;
  onNewLayer: (v: boolean) => void;
  onImport: (files: File[]) => void;
  onAdd: (m: MediaRecord) => void;
  onRemove: (m: MediaRecord) => void;
  onClearErrors: () => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const showLayer = items.some((m) => m.kind !== "audio");
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack-lg">
        <div className="media-actions">
          <button className="btn btn-primary btn-wide" disabled={imp.busy} onClick={() => input.current?.click()}>
            <Icon name="plus" size={20} /> {imp.busy ? imp.label : "İçe aktar"}
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept={accept}
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onImport(files);
              e.target.value = "";
            }}
          />
          <p className="hint">Fotoğraflar, Dosyalar veya kamera üzerinden birden fazla dosya seçebilirsin.</p>
        </div>

        {imp.errors.length > 0 && (
          <div className="notice" role="alert">
            <Icon name="alert" size={20} />
            <div>
              {imp.errors.map((er, i) => (
                <p key={i}>{er}</p>
              ))}
              <button className="link" onClick={onClearErrors}>
                Kapat
              </button>
            </div>
          </div>
        )}

        {showLayer && (
          <label className="toggle-row">
            <span>Yeni katman olarak ekle</span>
            <input type="checkbox" checked={newLayer} onChange={(e) => onNewLayer(e.target.checked)} />
          </label>
        )}

        {items.length === 0 ? (
          <div className="empty compact">
            <Icon name="media" size={30} />
            <p className="muted">Henüz medya yok</p>
          </div>
        ) : (
          <ul className="media-list">
            {items.map((m) => (
              <li key={m.id} className="media-item">
                <button className="media-main" onClick={() => onAdd(m)} aria-label={`${m.name} dosyasını zaman çizelgesine ekle`}>
                  <span className="media-thumb">
                    {m.thumbs[0] ? <img src={m.thumbs[0]} alt="" /> : <Icon name={m.kind === "audio" ? "music" : "media"} size={22} />}
                  </span>
                  <span className="media-text">
                    <strong>{m.name}</strong>
                    <small>{meta(m)}</small>
                  </span>
                </button>
                <button className="icon-btn" aria-label={`${m.name} dosyasını sil`} onClick={() => onRemove(m)}>
                  <Icon name="trash" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
