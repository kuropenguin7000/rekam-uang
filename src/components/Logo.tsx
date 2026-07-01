interface BrandMarkProps {
  className?: string;
}

/**
 * Rekam Uang app mark — an indigo tile holding a white coin ring with a central
 * "record" dot: money (the coin) + recording it (the dot). Self-contained SVG
 * (its own gradient) so the same artwork backs the header logo, the login mark,
 * and the favicon at `app/icon.svg`. Scales cleanly down to 16px.
 */
export function BrandMark({ className = "h-9 w-9" }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Rekam Uang"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="ru-mark-grad"
          x1="0"
          y1="0"
          x2="32"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* tile */}
      <rect width="32" height="32" rx="9" fill="url(#ru-mark-grad)" />

      {/* coin ring */}
      <circle cx="16" cy="16" r="8.4" stroke="#ffffff" strokeWidth="2.4" />

      {/* upward "growth" tick across the coin */}
      <path
        d="M12.2 18.2 15 15.2l2.2 2 2.6-3.2"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />

      {/* record dot */}
      <circle cx="16" cy="16" r="2.7" fill="#ffffff" />
    </svg>
  );
}
