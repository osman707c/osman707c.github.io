// src/timeline.ts
// Zaman çizelgesi işlemleri: saf fonksiyonlar, her biri yeni bir Track[] döndürür.
import type { Clip, CropId, MediaRecord, Rotation, TextStyle, Track, TrackKind } from "./types";
import { uid } from "./project";

export const STILL_DEFAULT = 3;
export const MIN_DUR = 0.2;
export const MAX_STILL = 600;

export const clipEnd = (c: Clip): number => c.start + c.duration;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function projectDuration(tracks: Track[]): number {
  let m = 0;
  for (const t of tracks) for (const c of t.clips) m = Math.max(m, clipEnd(c));
  return m;
}

export function findClip(tracks: Track[], id: string): { track: Track; clip: Clip } | null {
  for (const track of tracks) {
    const clip = track.clips.find((c) => c.id === id);
    if (clip) return { track, clip };
  }
  return null;
}

function newClip(trackId: string, p: Partial<Clip> & { start: number; duration: number }): Clip {
  return {
    id: uid(),
    trackId,
    mediaId: null,
    sourceIn: 0,
    sourceOut: p.duration,
    speed: 1,
    volume: 1,
    rotation: 0,
    crop: "none",
    text: null,
    effects: [],
    keyframes: [],
    ...p,
  };
}

const cloneTracks = (tracks: Track[]): Track[] => tracks.map((t) => ({ ...t, clips: t.clips.slice() }));

/** Aynı kanalda çakışmayan, istenen konuma en yakın başlangıç zamanı. */
export function freeStart(clips: Clip[], desired: number, dur: number, ignoreId?: string): number {
  const others = clips.filter((c) => c.id !== ignoreId).sort((a, b) => a.start - b.start);
  const fits = (s: number) => others.every((o) => s + dur <= o.start + 1e-6 || s >= clipEnd(o) - 1e-6);
  const cands = [desired, 0, ...others.flatMap((o) => [clipEnd(o), o.start - dur])];
  let best = -1;
  let bestDist = Infinity;
  for (const c of cands) {
    const s = Math.max(0, c);
    if (fits(s)) {
      const d = Math.abs(s - desired);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
  }
  if (best >= 0) return best;
  return others.length ? clipEnd(others[others.length - 1]) : 0;
}

function insertIndex(tracks: Track[], kind: TrackKind, top: boolean): number {
  if (kind === "text") return 0;
  if (kind === "audio") return tracks.length;
  const afterTexts = tracks.findIndex((t) => t.kind !== "text");
  const base = afterTexts === -1 ? tracks.length : afterTexts;
  const firstVideo = tracks.findIndex((t) => t.kind === "video");
  if (top) return firstVideo >= 0 ? firstVideo : base;
  let lastVideo = -1;
  tracks.forEach((t, i) => {
    if (t.kind === "video") lastVideo = i;
  });
  return lastVideo >= 0 ? lastVideo + 1 : base;
}

function makeTrack(kind: TrackKind): Track {
  const names: Record<TrackKind, string> = { video: "Video", image: "Görsel", audio: "Ses", text: "Metin" };
  return { id: uid(), kind, name: names[kind], locked: false, visible: true, muted: false, clips: [] };
}

export function addMedia(
  tracks: Track[],
  media: MediaRecord,
  playhead: number,
  newLayer: boolean,
): { tracks: Track[]; clipId: string; start: number } {
  const next = cloneTracks(tracks);
  const dur = media.kind === "image" ? STILL_DEFAULT : media.duration;

  let track: Track | undefined;
  let start = 0;
  if (media.kind === "audio") {
    track = next.find((t) => t.kind === "audio");
    if (!track) {
      track = makeTrack("audio");
      next.splice(insertIndex(next, "audio", false), 0, track);
    }
    start = freeStart(track.clips, playhead, dur);
  } else {
    const videoTracks = next.filter((t) => t.kind === "video");
    if (newLayer && videoTracks.length > 0) {
      track = makeTrack("video");
      next.splice(insertIndex(next, "video", true), 0, track);
      start = playhead;
    } else if (videoTracks.length > 0) {
      track = videoTracks[videoTracks.length - 1]; // en alttaki = ana katman
      start = track.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
    } else {
      track = makeTrack("video");
      next.splice(insertIndex(next, "video", false), 0, track);
      start = 0;
    }
  }
  const clip = newClip(track.id, {
    mediaId: media.id,
    start,
    duration: dur,
    sourceIn: 0,
    sourceOut: dur,
  });
  track.clips.push(clip);
  return { tracks: next, clipId: clip.id, start };
}

export function addText(tracks: Track[], playhead: number, content: string): { tracks: Track[]; clipId: string; start: number } {
  const next = cloneTracks(tracks);
  const dur = STILL_DEFAULT;
  let track = next.find(
    (t) => t.kind === "text" && t.clips.every((c) => playhead + dur <= c.start + 1e-6 || playhead >= clipEnd(c) - 1e-6),
  );
  if (!track) {
    track = makeTrack("text");
    next.splice(insertIndex(next, "text", true), 0, track);
  }
  const text: TextStyle = { content, size: 0.08, color: "#ffffff" };
  const clip = newClip(track.id, { start: playhead, duration: dur, sourceIn: 0, sourceOut: dur, text });
  track.clips.push(clip);
  return { tracks: next, clipId: clip.id, start: playhead };
}

function replaceClip(tracks: Track[], id: string, fn: (c: Clip) => Clip): Track[] {
  return tracks.map((t) => (t.clips.some((c) => c.id === id) ? { ...t, clips: t.clips.map((c) => (c.id === id ? fn(c) : c)) } : t));
}

export function updateClip(tracks: Track[], id: string, patch: Partial<Clip>): Track[] {
  return replaceClip(tracks, id, (c) => ({ ...c, ...patch }));
}

export function cleanup(tracks: Track[]): Track[] {
  return tracks.filter((t) => t.clips.length > 0);
}

export function deleteClip(tracks: Track[], id: string): Track[] {
  return cleanup(tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })));
}

export function removeMediaClips(tracks: Track[], mediaId: string): Track[] {
  return cleanup(tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.mediaId !== mediaId) })));
}

export function duplicateClip(tracks: Track[], id: string): { tracks: Track[]; clipId: string } | null {
  const f = findClip(tracks, id);
  if (!f) return null;
  const copy: Clip = { ...f.clip, id: uid(), start: freeStart(f.track.clips, clipEnd(f.clip), f.clip.duration) };
  return {
    tracks: tracks.map((t) => (t.id === f.track.id ? { ...t, clips: [...t.clips, copy] } : t)),
    clipId: copy.id,
  };
}

export function splitClip(tracks: Track[], id: string, t: number): { tracks: Track[]; clipId: string } | null {
  const f = findClip(tracks, id);
  if (!f) return null;
  const c = f.clip;
  if (t <= c.start + MIN_DUR || t >= clipEnd(c) - MIN_DUR) return null;
  const leftDur = t - c.start;
  const splitSrc = c.sourceIn + leftDur * c.speed;
  const left: Clip = { ...c, duration: leftDur, sourceOut: splitSrc };
  const right: Clip = { ...c, id: uid(), start: t, duration: c.duration - leftDur, sourceIn: splitSrc };
  return {
    tracks: tracks.map((tr) =>
      tr.id === f.track.id ? { ...tr, clips: tr.clips.flatMap((x) => (x.id === id ? [left, right] : [x])) } : tr,
    ),
    clipId: right.id,
  };
}

/** Kliibi başka bir kanala (aynı türde) ve/veya başka bir zamana taşır; çakışmayı çözer. */
export function moveClip(tracks: Track[], id: string, toTrackId: string, desiredStart: number): Track[] {
  const f = findClip(tracks, id);
  if (!f) return tracks;
  const target = tracks.find((t) => t.id === toTrackId);
  const sameKind = target && (target.kind === f.track.kind || (target.kind === "image" && f.track.kind === "video"));
  const dest = sameKind && target ? target : f.track;
  const start = freeStart(dest.clips, Math.max(0, desiredStart), f.clip.duration, id);
  const moved: Clip = { ...f.clip, start, trackId: dest.id };
  return tracks.map((t) => {
    if (t.id === f.track.id && t.id === dest.id) return { ...t, clips: t.clips.map((c) => (c.id === id ? moved : c)) };
    if (t.id === f.track.id) return { ...t, clips: t.clips.filter((c) => c.id !== id) };
    if (t.id === dest.id) return { ...t, clips: [...t.clips, moved] };
    return t;
  });
}

export function trimLeft(tracks: Track[], id: string, newIn: number): Track[] {
  const f = findClip(tracks, id);
  if (!f) return tracks;
  const c = f.clip;
  const prevEnd = f.track.clips
    .filter((o) => o.id !== id && clipEnd(o) <= c.start + 1e-6)
    .reduce((m, o) => Math.max(m, clipEnd(o)), 0);
  const minIn = Math.max(0, c.sourceIn - (c.start - prevEnd) * c.speed);
  const maxIn = c.sourceOut - MIN_DUR * c.speed;
  const sIn = clamp(newIn, minIn, Math.max(minIn, maxIn));
  const delta = (sIn - c.sourceIn) / c.speed;
  return replaceClip(tracks, id, (x) => ({ ...x, sourceIn: sIn, start: x.start + delta, duration: x.duration - delta }));
}

export function trimRight(tracks: Track[], id: string, newOut: number, maxSource: number): Track[] {
  const f = findClip(tracks, id);
  if (!f) return tracks;
  const c = f.clip;
  const nextStart = f.track.clips
    .filter((o) => o.id !== id && o.start >= clipEnd(c) - 1e-6)
    .reduce((m, o) => Math.min(m, o.start), Infinity);
  const byNeighbor = c.sourceIn + (nextStart - c.start) * c.speed;
  const lo = c.sourceIn + MIN_DUR * c.speed;
  const hi = Math.max(lo, Math.min(maxSource, byNeighbor));
  const sOut = clamp(newOut, lo, hi);
  return replaceClip(tracks, id, (x) => ({ ...x, sourceOut: sOut, duration: (sOut - x.sourceIn) / x.speed }));
}

/** Hız değişince süre de değişir; aynı kanaldaki sonraki klipler kayar. */
export function setSpeed(tracks: Track[], id: string, speed: number): Track[] {
  const f = findClip(tracks, id);
  if (!f) return tracks;
  const c = f.clip;
  const newDur = (c.sourceOut - c.sourceIn) / speed;
  const delta = newDur - c.duration;
  const oldEnd = clipEnd(c);
  return tracks.map((t) =>
    t.id !== f.track.id
      ? t
      : {
          ...t,
          clips: t.clips.map((o) => {
            if (o.id === id) return { ...o, speed, duration: newDur };
            if (o.start >= oldEnd - 1e-6) return { ...o, start: Math.max(0, o.start + delta) };
            return o;
          }),
        },
  );
}

export function rotateClip(tracks: Track[], id: string): Track[] {
  return replaceClip(tracks, id, (c) => ({ ...c, rotation: ((c.rotation + 90) % 360) as Rotation }));
}

export function setCrop(tracks: Track[], id: string, crop: CropId): Track[] {
  return updateClip(tracks, id, { crop });
}

export function toggleMute(tracks: Track[], trackId: string): Track[] {
  return tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t));
}
