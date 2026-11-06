// src/types.ts
// Proje veri modeli. Tüm süreler SANİYE cinsindendir (zaman çizelgesi motoru bu birimi kullanacak).

export type AspectId = "9:16" | "16:9" | "1:1" | "custom";
export type Fps = 24 | 30 | 60;
export type TrackKind = "video" | "audio" | "image" | "text";
export type Interpolation = "linear" | "easeIn" | "easeOut" | "easeInOut" | "hold";

export interface Keyframe {
  time: number; // klip başlangıcına göre saniye
  value: number;
  interpolation: Interpolation;
}

export interface KeyframeTrack {
  property: string; // ör. "opacity", "scale", "x", "y", "rotation"
  keyframes: Keyframe[];
}

export interface Effect {
  id: string;
  type: string; // ör. "brightness", "contrast", "blur"
  enabled: boolean;
  params: Record<string, number>;
}

export interface Clip {
  id: string;
  trackId: string;
  mediaId: string | null; // metin klipleri için null
  start: number; // zaman çizelgesindeki başlangıç
  duration: number; // zaman çizelgesindeki süre
  sourceIn: number; // kaynak medyadaki giriş noktası
  sourceOut: number; // kaynak medyadaki çıkış noktası
  speed: number;
  effects: Effect[];
  keyframes: KeyframeTrack[];
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  locked: boolean;
  visible: boolean;
  muted: boolean;
  clips: Clip[];
}

export interface ProjectSettings {
  aspect: AspectId;
  width: number;
  height: number;
  fps: Fps;
}

export interface Project {
  schema: 1;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
  tracks: Track[];
}
