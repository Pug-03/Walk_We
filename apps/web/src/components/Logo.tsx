/**
 * The Walk We mark: a W drawn as one walking route that leaves the shade
 * (sky) and crosses into the sun (amber); the dot is the walker. Same
 * drawing as public/icon.svg.
 */
export function LogoMark({ size = 36, title, bare, className }: { size?: number; title?: string; bare?: boolean; className?: string }) {
  // bare: just the W, cropped to its own bounds (no tile), sized by CSS so it
  // can stand in for the letter W in the wordmark.
  return (
    <svg
      width={bare ? undefined : size}
      height={bare ? undefined : size}
      viewBox={bare ? '70 134 364 244' : '0 0 512 512'}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {!bare && <rect width="512" height="512" rx="120" fill="#050B1A" />}
      <path d="M256 216 L324 352 L408 168" fill="none" stroke="#9D94FF" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M104 168 L188 352 L256 216" fill="none" stroke="#3CC8F2" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="168" r="34" fill="#EEF4FF" />
    </svg>
  );
}
