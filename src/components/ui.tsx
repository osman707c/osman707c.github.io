// src/components/ui.tsx
// Ortak bileşenler: alt sayfa (Sheet), segmentli kontrol, onay ve yeniden adlandırma.
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Icon } from "./icons";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("locked");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("locked");
    };
  }, [onClose]);

  return (
    <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grab" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Kapat" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <div className="stack">
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn btn-secondary" onClick={onClose}>
          Vazgeç
        </button>
      </div>
    </Sheet>
  );
}

export function RenameSheet({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
          aria-label="Proje adı"
        />
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Kaydet
        </button>
      </form>
    </Sheet>
  );
}
