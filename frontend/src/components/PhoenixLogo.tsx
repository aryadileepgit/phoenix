interface PhoenixLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

/**
 * Original Phoenix wordmark glyph — an abstracted rising-wing silhouette
 * built from angular vector strokes rather than a literal bird illustration,
 * so it reads as a security/telemetry mark rather than clip-art.
 */
export function PhoenixLogo({ size = 40, className = "", glow = false }: PhoenixLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: "drop-shadow(0 0 14px rgba(249,115,22,0.55))" } : undefined}
    >
      <defs>
        <linearGradient id="phx-grad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDBA74" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>
      </defs>
      {/* core spark */}
      <circle cx="32" cy="34" r="5.5" fill="url(#phx-grad)" />
      {/* left wing — three angular feather strokes rising outward */}
      <path d="M32 34 L6 14" stroke="url(#phx-grad)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 34 L4 28" stroke="url(#phx-grad)" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
      <path d="M32 34 L8 42" stroke="url(#phx-grad)" strokeWidth="3.4" strokeLinecap="round" opacity="0.7" />
      {/* right wing — mirrored */}
      <path d="M32 34 L58 14" stroke="url(#phx-grad)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 34 L60 28" stroke="url(#phx-grad)" strokeWidth="3.4" strokeLinecap="round" opacity="0.85" />
      <path d="M32 34 L56 42" stroke="url(#phx-grad)" strokeWidth="3.4" strokeLinecap="round" opacity="0.7" />
      {/* rising tail flame */}
      <path
        d="M32 34 C 28 44, 30 52, 32 60 C 34 52, 36 44, 32 34 Z"
        fill="url(#phx-grad)"
        opacity="0.9"
      />
    </svg>
  );
}
