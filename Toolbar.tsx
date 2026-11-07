// src/components/Toolbar.tsx
// Alt araç çubuğu: kök (Medya, Ses, Metin) -> klip araçları -> araç paneli.
import type { Clip, CropId, MediaRecord, TextStyle } from "../types";
import { MAX_STILL } from "../timeline";
import { Icon, type IconName } from "./icons";

export type Panel = "trim" | "volume" | "speed" | "crop" | "text" | null;

export interface ClipActions {
  split: () => void;
  duplicate: () => void;
  remove: () => void;
  rotate: () => void;
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  setCrop: (c: CropId) => void;
  trimIn: (v: number) => void;
  trimOut: (v: number) => void;
  setText: (p: Partial<TextStyle>) => void;
}

interface Props {
  clip: Clip | null;
  media: MediaRecord | null;
  panel: Panel;
  setPanel: (p: Panel) => void;
  onBack: () => void;
  onOpenMedia: () => void;
  onOpenAudio: () => void;
  onAddText: () => void;
  act: ClipActions;
}

function Tool({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="tool" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
const CROPS: { id: CropId; label: string }[] = [
  { id: "none", label: "Orijinal" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
];
const COLORS = ["#ffffff", "#f5d76e", "#ff6b5e", "#5ec8ff", "#8be28b", "#111111"];
const SIZES: { v: number; label: string }[] = [
  { v: 0.05, label: "S" },
  { v: 0.08, label: "M" },
  { v: 0.12, label: "L" },
  { v: 0.17, label: "XL" },
];

const sec = (v: number) => `${v.toFixed(1)} sn`;

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span>{label}</span>
        <span>{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function PanelBody({ clip, media, panel, act }: { clip: Clip; media: MediaRecord | null; panel: Exclude<Panel, null>; act: ClipActions }) {
  const still = !!clip.text || media?.kind === "image";
  if (panel === "trim") {
    if (still) {
      return (
        <Slider
          label="Süre"
          value={Math.min(30, clip.duration)}
          min={0.5}
          max={30}
          step={0.1}
          display={sec(clip.duration)}
          onChange={(v) => act.trimOut(clip.sourceIn + v * clip.speed)}
        />
      );
    }
    const max = Math.max(0.5, media?.duration ?? MAX_STILL);
    return (
      <div className="panel-stack">
        <Slider label="Başlangıç" value={clip.sourceIn} min={0} max={max} step={0.05} display={sec(clip.sourceIn)} onChange={act.trimIn} />
        <Slider label="Bitiş" value={clip.sourceOut} min={0} max={max} step={0.05} display={sec(clip.sourceOut)} onChange={act.trimOut} />
      </div>
    );
  }
  if (panel === "volume") {
    const pct = Math.round(clip.volume * 100);
    return (
      <div className="panel-stack">
        <Slider label="Ses" value={pct} min={0} max={200} step={1} display={`%${pct}`} onChange={(v) => act.setVolume(v / 100)} />
        <div className="chips">
          <button className={`chip${clip.volume === 0 ? " on" : ""}`} onClick={() => act.setVolume(clip.volume === 0 ? 1 : 0)}>
            Sessiz
          </button>
          <button className="chip" onClick={() => act.setVolume(1)}>
            Sıfırla
          </button>
        </div>
      </div>
    );
  }
  if (panel === "speed") {
    return (
      <div className="chips">
        {SPEEDS.map((s) => (
          <button key={s} className={`chip${clip.speed === s ? " on" : ""}`} onClick={() => act.setSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
    );
  }
  if (panel === "crop") {
    return (
      <div className="chips">
        {CROPS.map((c) => (
          <button key={c.id} className={`chip${clip.crop === c.id ? " on" : ""}`} onClick={() => act.setCrop(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
    );
  }
  // metin düzenleme
  const t = clip.text;
  if (!t) return null;
  return (
    <div className="panel-stack">
      <input
        className="input"
        value={t.content}
        maxLength={120}
        aria-label="Metin"
        onChange={(e) => act.setText({ content: e.target.value })}
      />
      <div className="chips">
        {SIZES.map((s) => (
          <button key={s.label} className={`chip${t.size === s.v ? " on" : ""}`} onClick={() => act.setText({ size: s.v })}>
            {s.label}
          </button>
        ))}
        <span className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${t.color === c ? " on" : ""}`}
              style={{ background: c }}
              aria-label={`Renk ${c}`}
              onClick={() => act.setText({ color: c })}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export function Toolbar({ clip, media, panel, setPanel, onBack, onOpenMedia, onOpenAudio, onAddText, act }: Props) {
  if (!clip) {
    return (
      <nav className="toolbar" aria-label="Araçlar">
        <div className="tb-scroll">
          <Tool icon="media" label="Medya" onClick={onOpenMedia} />
          <Tool icon="music" label="Ses" onClick={onOpenAudio} />
          <Tool icon="text" label="Metin" onClick={onAddText} />
        </div>
      </nav>
    );
  }

  const isText = !!clip.text;
  const kind = isText ? "text" : media?.kind ?? "video";

  return (
    <nav className="toolbar" aria-label="Klip araçları">
      <button className="tb-back" aria-label="Geri" onClick={panel ? () => setPanel(null) : onBack}>
        <Icon name="back" size={20} />
      </button>
      {panel ? (
        <div className="tb-panel">
          <PanelBody clip={clip} media={media} panel={panel} act={act} />
        </div>
      ) : (
        <div className="tb-scroll">
          {isText && <Tool icon="edit" label="Düzenle" onClick={() => setPanel("text")} />}
          <Tool icon="trim" label={kind === "video" || kind === "audio" ? "Kısalt" : "Süre"} onClick={() => setPanel("trim")} />
          <Tool icon="scissors" label="Böl" onClick={act.split} />
          {(kind === "video" || kind === "audio") && <Tool icon="volume" label="Ses" onClick={() => setPanel("volume")} />}
          {(kind === "video" || kind === "audio") && <Tool icon="speed" label="Hız" onClick={() => setPanel("speed")} />}
          {(kind === "video" || kind === "image") && <Tool icon="crop" label="Çerçeve" onClick={() => setPanel("crop")} />}
          {(kind === "video" || kind === "image") && <Tool icon="rotate" label="Döndür" onClick={act.rotate} />}
          <Tool icon="copy" label="Çoğalt" onClick={act.duplicate} />
          <Tool icon="trash" label="Sil" onClick={act.remove} />
        </div>
      )}
    </nav>
  );
}
