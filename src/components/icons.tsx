// src/components/icons.tsx
// Tek ikon ailesi: 24px ızgara, 1.6 çizgi kalınlığı, yuvarlak uçlar.
const PATHS = {
  plus: "M12 5v14M5 12h14",
  back: "M14.5 5l-7 7 7 7",
  close: "M6 6l12 12M18 6L6 18",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  tune: "M4 8h9M17 8h3M4 16h3M11 16h9M15 5.5v5M9 13.5v5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14",
  upload: "M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14",
  trash: "M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10.5 11v5M13.5 11v5",
  copy: "M9 9h10v10H9zM15 9V5H5v10h4",
  edit: "M5 19l1-4L16.5 4.5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L9 18z",
  film: "M4 6h16v12H4zM8 6v12M16 6v12M4 10h4M4 14h4M16 10h4M16 14h4",
  play: "M8 5.5v13l11-6.5z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  undo: "M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  shrink: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  scissors:
    "M8.5 6a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM8.5 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM8.2 7.8L20 18M8.2 16.2L20 6",
  volume: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  volumeOff: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5",
  speed: "M4.5 17a8 8 0 1 1 15 0M12 13l4-4M12 13h.01",
  crop: "M7 3v14h14M3 7h14v14",
  rotate: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  trim: "M6 4v16M18 4v16M6 12h12M9 9l-3 3 3 3M15 9l3 3-3 3",
  text: "M5 6V4.5h14V6M12 4.5v15M9 19.5h6",
  music:
    "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z",
  photo: "M4 5h16v14H4zM4 16l4.5-4.5L13 16l3-3 4 4M9 9.5h.01",
  media: "M4 5h16v14H4zM10.5 9.2v5.6L15 12z",
  zoomIn: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4M8.5 11h5M11 8.5v5",
  zoomOut: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4M8.5 11h5",
  alert:
    "M12 8v5M12 16.5h.01M10.3 4.6L3.5 17a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z",
} as const;

export type IconName = keyof typeof PATHS;

const FILLED = new Set<IconName>(["play", "pause"]);

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={FILLED.has(name) ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "more" ? 2.6 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
