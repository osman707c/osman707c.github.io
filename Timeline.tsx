// src/components/Timeline.tsx
// Çok katmanlı zaman çizelgesi. Oynatma çizgisi sabit, içerik altından kayar (yatay kaydırma = zaman).
// Bir klibe dokun: seçilir. Seçili klibi sürükle: taşınır. Uç tutamaçlarını sürükle: kısaltılır/uzatılır.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { Clip, MediaRecord, Track } from "../types";
import type { Player } from "../engine";
import { MAX_STILL, clipEnd, findClip, moveClip, projectDuration, trimLeft, trimRight } from "../timeline";
import { Icon } from "./icons";

export const PPS_MIN = 8;
export const PPS_MAX = 160;
const ROW_H = 54;
const ROW_GAP = 8;
const ROWS_PAD = 8;
const RULER_H = 30;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  player: Player;
  tracks: Track[];
  media: Map<string, MediaRecord>;
  selectedId: string | null;
  pps: number;
  onSelect: (id: string | null) => void;
  onPps: (pps: number) => void;
  onMove: (clipId: string, trackId: string, start: number) => void;
  onTrimLeft: (clipId: string, newIn: number) => void;
  onTrimRight: (clipId: string, newOut: number) => void;
  onToggleMute: (trackId: string) => void;
}

type Drag =
  | { kind: "move"; id: string; trackId: string; start: number }
  | { kind: "l" | "r"; id: string; value: number };

interface DragRef {
  kind: "move" | "l" | "r";
  id: string;
  x0: number;
  y0: number;
  moved: boolean;
  start0: number;
  dur: number;
  trackId0: string;
  in0: number;
  out0: number;
  speed: number;
}

function maxSourceOf(clip: Clip, media: Map<string, MediaRecord>): number {
  const m = clip.mediaId ? media.get(clip.mediaId) : undefined;
  return !m || m.kind === "image" ? MAX_STILL : m.duration;
}

function Wave({ peaks, perSec, from, to, width }: { peaks: Uint8Array; perSec: number; from: number; to: number; width: number }) {
  const d = useMemo(() => {
    const bars = Math.max(1, Math.min(900, Math.floor(width / 3)));
    const mid = ROW_H / 2;
    let s = "";
    for (let i = 0; i < bars; i++) {
      const t = from + ((i + 0.5) / bars) * (to - from);
      const idx = Math.min(peaks.length - 1, Math.max(0, Math.floor(t * perSec)));
      const h = Math.max(2, (peaks[idx] / 255) * (ROW_H - 14));
      const x = ((i + 0.5) / bars) * width;
      s += `M${x.toFixed(1)} ${(mid - h / 2).toFixed(1)}V${(mid + h / 2).toFixed(1)}`;
    }
    return s;
  }, [peaks, perSec, from, to, width]);
  return (
    <svg className="wave" width={width} height={ROW_H} viewBox={`0 0 ${width} ${ROW_H}`} aria-hidden="true">
      <path d={d} stroke="rgba(255,255,255,.85)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Strip({ media, from, to, width }: { media: MediaRecord; from: number; to: number; width: number }) {
  const tileW = Math.max(28, ROW_H * (media.thumbAspect || 1));
  const count = Math.max(1, Math.min(60, Math.ceil(width / tileW)));
  const tiles: string[] = [];
  for (let k = 0; k < count; k++) {
    const t = from + ((k + 0.5) / count) * (to - from);
    const idx =
      media.kind === "image"
        ? 0
        : Math.min(media.thumbs.length - 1, Math.max(0, Math.floor((t / Math.max(0.01, media.duration)) * media.thumbs.length)));
    tiles.push(media.thumbs[idx]);
  }
  return (
    <div className="strip" aria-hidden="true">
      {tiles.map((src, i) => (
        <img key={i} src={src} alt="" draggable={false} />
      ))}
    </div>
  );
}

export function Timeline(props: Props) {
  const { player, tracks, media, selectedId, pps, onSelect, onPps, onMove, onTrimLeft, onTrimRight, onToggleMute } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(360);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<DragRef | null>(null);
  const lastDrag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const progLeft = useRef(0);
  const ppsRef = useRef(pps);
  const tracksRef = useRef(tracks);
  ppsRef.current = pps;
  tracksRef.current = tracks;

  const half = viewW / 2;

  const view = useMemo(() => {
    if (!drag) return tracks;
    if (drag.kind === "move") return moveClip(tracks, drag.id, drag.trackId, drag.start);
    const f = findClip(tracks, drag.id);
    if (!f) return tracks;
    return drag.kind === "l" ? trimLeft(tracks, drag.id, drag.value) : trimRight(tracks, drag.id, drag.value, maxSourceOf(f.clip, media));
  }, [tracks, drag, media]);

  const dur = projectDuration(view);
  const innerW = half * 2 + Math.max(dur, 1) * pps;

  // görünüm genişliğini ölç
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewW(el.clientWidth || 360);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // yakınlaştırınca oynatma çizgisindeki zaman sabit kalsın
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = player.t * pps;
    progLeft.current = el.scrollLeft;
  }, [pps, viewW, dur, player]);

  // oynatma sırasında içeriği kaydır
  useEffect(() => {
    return player.subscribe((t) => {
      const el = scroller.current;
      if (!el) return;
      const target = t * ppsRef.current;
      if (Math.abs(el.scrollLeft - target) > 0.5) {
        el.scrollLeft = target;
        progLeft.current = el.scrollLeft;
      }
    });
  }, [player]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    if (Math.abs(el.scrollLeft - progLeft.current) < 1.5) return; // kod kaynaklı kaydırma
    if (player.playing) player.pause();
    player.seek(el.scrollLeft / ppsRef.current);
    progLeft.current = el.scrollLeft;
  };

  // iki parmakla yakınlaştırma
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let startDist = 0;
    let startPps = 0;
    const dist = (e: TouchEvent) =>
      Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e);
        startPps = ppsRef.current;
      }
    };
    const onMoveT = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        onPps(clamp(startPps * (dist(e) / startDist), PPS_MIN, PPS_MAX));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) startDist = 0;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMoveT, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMoveT);
      el.removeEventListener("touchend", onEnd);
    };
  }, [onPps]);

  /* ---------- Sürükleme ---------- */

  const snap = (s: number, d: number, id: string): number => {
    const thr = 9 / ppsRef.current;
    const edges = [0, player.t];
    for (const t of tracksRef.current) for (const c of t.clips) if (c.id !== id) edges.push(c.start, clipEnd(c));
    let best = s;
    let bd = thr;
    for (const e of edges) {
      const d1 = Math.abs(s - e);
      if (d1 < bd) {
        bd = d1;
        best = e;
      }
      const d2 = Math.abs(s + d - e);
      if (d2 < bd) {
        bd = d2;
        best = e - d;
      }
    }
    return Math.max(0, best);
  };

  const begin = (e: RPointerEvent<HTMLElement>, clip: Clip, kind: DragRef["kind"]) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind,
      id: clip.id,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      start0: clip.start,
      dur: clip.duration,
      trackId0: clip.trackId,
      in0: clip.sourceIn,
      out0: clip.sourceOut,
      speed: clip.speed,
    };
  };

  const onBodyDown = (e: RPointerEvent<HTMLDivElement>, clip: Clip) => {
    if (clip.id !== selectedId) return; // seçili değilse kaydırma çalışsın
    if ((e.target as HTMLElement).dataset.handle) return;
    begin(e, clip, "move");
  };

  const onDragMove = (e: RPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    let next: Drag;
    if (d.kind === "move") {
      const s = snap(Math.max(0, d.start0 + dx / ppsRef.current), d.dur, d.id);
      let trackId = d.trackId0;
      const rect = rowsRef.current?.getBoundingClientRect();
      const list = tracksRef.current;
      if (rect && list.length > 0) {
        const idx = Math.floor((e.clientY - rect.top - ROWS_PAD) / (ROW_H + ROW_GAP));
        trackId = list[clamp(idx, 0, list.length - 1)].id;
      }
      next = { kind: "move", id: d.id, trackId, start: s };
    } else if (d.kind === "l") {
      next = { kind: "l", id: d.id, value: d.in0 + (dx / ppsRef.current) * d.speed };
    } else {
      next = { kind: "r", id: d.id, value: d.out0 + (dx / ppsRef.current) * d.speed };
    }
    lastDrag.current = next;
    setDrag(next);
  };

  const onDragEnd = () => {
    const d = dragRef.current;
    const final = lastDrag.current;
    dragRef.current = null;
    lastDrag.current = null;
    if (d?.moved && final) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (final.kind === "move") onMove(final.id, final.trackId, final.start);
      else if (final.kind === "l") onTrimLeft(final.id, final.value);
      else onTrimRight(final.id, final.value);
    }
    setDrag(null);
  };

  /* ---------- Cetvel ---------- */

  const ruler = useMemo(() => {
    const majors = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const major = majors.find((m) => m * pps >= 64) ?? 600;
    const sub = major <= 2 ? 4 : 5;
    const end = Math.max(15, dur + major * 2);
    const out: { x: number; label?: string }[] = [];
    const step = major / sub;
    for (let t = 0, i = 0; t <= end + 1e-6 && i < 4000; t = (++i) * step) {
      const isMajor = i % sub === 0;
      const label = isMajor ? (t < 60 ? `${Math.round(t)}s` : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`) : undefined;
      out.push({ x: t * pps, label });
    }
    return out;
  }, [pps, dur]);

  const renderClip = (clip: Clip, track: Track) => {
    const m = clip.mediaId ? media.get(clip.mediaId) : undefined;
    const left = half + clip.start * pps;
    const width = Math.max(10, clip.duration * pps);
    const selected = clip.id === selectedId;
    const kind = clip.text ? "text" : m?.kind ?? "missing";
    const cls = `clip ${kind}${selected ? " selected" : ""}${drag?.id === clip.id ? " dragging" : ""}`;
    const from = clip.sourceIn;
    const to = clip.sourceOut;
    return (
      <div
        key={clip.id}
        className={cls}
        style={{ left, width }}
        onClick={(e) => {
          e.stopPropagation();
          if (!suppressClick.current) onSelect(clip.id);
        }}
        onPointerDown={(e) => onBodyDown(e, clip)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        {m && (m.kind === "video" || m.kind === "image") && m.thumbs.length > 0 && (
          <Strip media={m} from={from} to={to} width={width} />
        )}
        {m && m.kind === "audio" && (
          <>
            <span className="clip-label">
              <Icon name="music" size={14} />
              <span>{m.name}</span>
            </span>
            {m.peaks && <Wave peaks={m.peaks} perSec={m.peaksPerSec} from={from} to={to} width={width} />}
          </>
        )}
        {clip.text && (
          <span className="clip-label">
            <Icon name="text" size={14} />
            <span>{clip.text.content}</span>
          </span>
        )}
        {m && (m.kind === "video" || m.kind === "image") && m.thumbs.length === 0 && (
          <span className="clip-label">
            <Icon name={m.kind === "video" ? "media" : "photo"} size={14} />
            <span>{m.name}</span>
          </span>
        )}
        {!m && !clip.text && <span className="clip-label">Medya bulunamadı</span>}
        {track.muted && (kind === "video" || kind === "audio") && <span className="clip-muted"><Icon name="volumeOff" size={13} /></span>}
        {selected && (
          <>
            <span
              className="handle l"
              data-handle="l"
              onPointerDown={(e) => begin(e, clip, "l")}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            />
            <span
              className="handle r"
              data-handle="r"
              onPointerDown={(e) => begin(e, clip, "r")}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="tl-wrap">
      <div className="tl-scroll" ref={scroller} onScroll={onScroll} onClick={() => onSelect(null)}>
        <div className="tl-inner" style={{ width: innerW }}>
          <div className="tl-ruler" style={{ height: RULER_H }}>
            {ruler.map((tk, i) => (
              <span key={i} className={tk.label ? "tick major" : "tick"} style={{ left: half + tk.x }}>
                {tk.label}
              </span>
            ))}
          </div>
          <div className="tl-rows" ref={rowsRef} style={{ paddingTop: ROWS_PAD, gap: ROW_GAP }}>
            {view.map((track) => (
              <div key={track.id} className="tl-row" style={{ height: ROW_H }}>
                {(track.kind === "audio" || track.kind === "video") && (
                  <button
                    className={`tl-mute${track.muted ? " off" : ""}`}
                    aria-label={track.muted ? "Sesi aç" : "Sesi kapat"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMute(track.id);
                    }}
                  >
                    <Icon name={track.muted ? "volumeOff" : "volume"} size={16} />
                  </button>
                )}
                {track.clips.map((c) => renderClip(c, track))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="playhead" aria-hidden="true" />
      {tracks.length === 0 && (
        <div className="tl-empty">
          <p>Henüz klip yok</p>
          <small>Alttan Medya veya Metin ekle</small>
        </div>
      )}
    </div>
  );
}
