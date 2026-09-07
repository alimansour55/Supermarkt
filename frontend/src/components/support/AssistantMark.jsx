/**
 * Custom AI assistant glyph — outline chat bubble, typing dots, sparkle accent.
 * Single-color (currentColor); optimized for gradient FAB and avatar backgrounds.
 */
export default function AssistantMark({ className = 'h-6 w-6', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M16.5 4.25H8.25A2.75 2.75 0 0 0 5.5 7v5.75A2.75 2.75 0 0 0 8.25 15.5h1.65l2.55 2.85a.52.52 0 0 0 .88-.36V15.5H16.5a2.75 2.75 0 0 0 2.75-2.75V7a2.75 2.75 0 0 0-2.75-2.75Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinejoin="round"
      />
      <circle cx="9.25" cy="10.25" r="1.05" fill="currentColor" />
      <circle cx="12.25" cy="10.25" r="1.05" fill="currentColor" />
      <circle cx="15.25" cy="10.25" r="1.05" fill="currentColor" />
      <path
        fill="currentColor"
        d="M18.65 5.1l.48 1.48 1.48.48-1.48.48-.48 1.48-.48-1.48-1.48-.48 1.48-.48.48-1.48Z"
      />
    </svg>
  );
}
