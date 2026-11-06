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
  alert:
    "M12 8v5M12 16.5h.01M10.3 4.6L3.5 17a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
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
