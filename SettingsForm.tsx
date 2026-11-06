// src/components/SettingsForm.tsx
// Hem "Yeni proje" hem "Proje ayarları" tarafından kullanılan ortak form.
import { useState } from "react";
import type { AspectId, Fps, ProjectSettings } from "../types";
import { FPS_OPTIONS, clampSize, presetSize } from "../project";
import { Segmented } from "./ui";

const ASPECTS: { id: AspectId; name: string; w: number; h: number }[] = [
  { id: "9:16", name: "Dikey", w: 9, h: 16 },
  { id: "16:9", name: "Yatay", w: 16, h: 9 },
  { id: "1:1", name: "Kare", w: 1, h: 1 },
  { id: "custom", name: "Özel", w: 4, h: 5 },
];

function CustomSize({ value, onChange }: { value: ProjectSettings; onChange: (s: ProjectSettings) => void }) {
  const [w, setW] = useState(String(value.width));
  const [h, setH] = useState(String(value.height));
  const commit = () => {
    const width = clampSize(parseInt(w, 10));
    const height = clampSize(parseInt(h, 10));
    setW(String(width));
    setH(String(height));
    onChange({ ...value, aspect: "custom", width, height });
  };
  return (
    <div className="field">
      <div className="label">Boyut (piksel)</div>
      <div className="size-row">
        <input className="input" inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} onBlur={commit} aria-label="Genişlik" />
        <span className="muted">×</span>
        <input className="input" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} onBlur={commit} aria-label="Yükseklik" />
      </div>
      <p className="hint">240 ile 4096 arasında, çift sayı olmalı.</p>
    </div>
  );
}

export function SettingsForm({ value, onChange }: { value: ProjectSettings; onChange: (s: ProjectSettings) => void }) {
  const quality: 720 | 1080 = Math.min(value.width, value.height) === 720 ? 720 : 1080;

  const pickAspect = (id: AspectId) => {
    if (id === value.aspect) return;
    const size = presetSize(id, quality);
    onChange(size ? { ...value, aspect: id, ...size } : { ...value, aspect: "custom" });
  };

  return (
    <div className="stack-lg">
      <div className="field">
        <div className="label">En-boy oranı</div>
        <div className="aspect-grid">
          {ASPECTS.map((a) => {
            const k = 26 / Math.max(a.w, a.h);
            return (
              <button key={a.id} className="aspect" aria-pressed={a.id === value.aspect} onClick={() => pickAspect(a.id)}>
                <span className="glyph">
                  <i style={{ width: a.w * k, height: a.h * k }} />
                </span>
                <span>{a.id === "custom" ? "Özel" : a.id}</span>
                <small>{a.name}</small>
              </button>
            );
          })}
        </div>
      </div>

      {value.aspect === "custom" ? (
        <CustomSize key="custom" value={value} onChange={onChange} />
      ) : (
        <div className="field">
          <div className="label">Çözünürlük</div>
          <Segmented<number>
            value={quality}
            options={[
              { value: 720, label: "720p" },
              { value: 1080, label: "1080p" },
            ]}
            onChange={(q) => {
              const size = presetSize(value.aspect, q);
              if (size) onChange({ ...value, ...size });
            }}
          />
          <p className="hint">
            {value.width} × {value.height} piksel
          </p>
        </div>
      )}

      <div className="field">
        <div className="label">Kare hızı</div>
        <Segmented<Fps>
          value={value.fps}
          options={FPS_OPTIONS.map((f) => ({ value: f, label: `${f} fps` }))}
          onChange={(fps) => onChange({ ...value, fps })}
        />
      </div>
    </div>
  );
}
