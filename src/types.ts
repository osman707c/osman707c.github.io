// src/types.ts
// Proje veri modeli. Tüm süreler SANİYE cinsindendir.

export type AspectId = "9:16" | "16:9" | "1:1" | "custom";
export type Fps = 24 | 30 | 60;
export type TrackKind = "video" | "audio" | "image" | "text";
export type MediaKind = "video" | "image" | "audio";
export type Interpolation = "linear" | "easeIn" | "easeOut" | "easeInOut" | "hold";
export type CropId = "none" | "1:1" | "4:5" | "16:9" | "9:16";
export type Rotation = 0 | 90 | 180 | 270;

export interface Keyframe {
  time: number;
  value: number;
  interpolation: Interpolation;
}

export interface KeyframeTrack {
  property: string;
  keyframes: Keyframe[];
}

export interface Effect {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, number>;
}

export interface TextStyle {
  content: string;
  size: number; // tuval yüksekliğinin oranı (0.03 - 0.2)
  color: string;
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
  volume: number; // 0 - 2
  rotation: Rotation;
  crop: CropId;
  text: TextStyle | null;
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
  mediaIds: string[];
}

/** IndexedDB "media" deposunda saklanan kayıt. Dosyanın kendisi (blob) burada durur. */
export interface MediaRecord {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  duration: number; // saniye (fotoğraf için 0)
  width: number;
  height: number;
  createdAt: number;
  blob: Blob;
  thumbs: string[]; // küçük JPEG data URL'leri (zaman çizelgesi şeridi)
  thumbAspect: number;
  peaks: Uint8Array | null; // ses dalga formu (0-255), saniyede peaksPerSec adet
  peaksPerSec: number;
}
