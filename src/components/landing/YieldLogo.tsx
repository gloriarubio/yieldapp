"use client";

export function YieldLogo({ size = 24 }: { size?: number }) {
  const h = Math.round(size * 0.6);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 160 80"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 65 C45 65 60 5 90 5 C120 5 122 35 152 20"
        stroke="#C8B49A"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle cx="152" cy="20" r="9" fill="#C8B49A" />
    </svg>
  );
}
