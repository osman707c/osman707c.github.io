// src/components/Logo.tsx
// Nashi (Japon armudu) işareti: armut gövdesi, tek bir kesik çizgisi (kurgu "cut") ve aksan renginde sap.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Nashi Studio">
      <defs>
        <mask id="nashi-cut">
          <rect width="48" height="48" fill="#fff" />
          <path d="M10 31L38 25" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        mask="url(#nashi-cut)"
        fill="currentColor"
        transform="translate(0 -3)"
        d="M24 12c-4.6 0-7.6 3.2-7.6 7 0 2.4 1 4 2.4 5.6C16.8 26.4 14 29.2 14 33.6 14 39.2 18.4 43 24 43s10-3.8 10-9.4c0-4.4-2.8-7.2-4.8-9C30.6 23 31.6 21.4 31.6 19c0-3.8-3-7-7.6-7z"
      />
      <path d="M24 9c0-2.6 1.2-4.6 3.4-5.6" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
