export function Logo({ size = 28 }: { size?: number }) {
  // A small beacon mark — the "beacon" in Beakon.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#1d342f" />
      <path d="M16 7l4.5 8.5h-9L16 7z" fill="#dae995" />
      <rect x="13.4" y="15" width="5.2" height="10" rx="1.4" fill="#97cec2" />
      <circle cx="16" cy="7" r="1.8" fill="#dae995" />
      <path d="M8 12.5c1.2-1.6 2.4-2.4 3.6-2.4" stroke="#dae995" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <path d="M24 12.5c-1.2-1.6-2.4-2.4-3.6-2.4" stroke="#dae995" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
