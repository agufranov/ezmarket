const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const PlaneIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path
      fill="currentColor"
      d="M20.7 4.3 3.4 11c-1.2.5-1.2 1.2-.2 1.5l4.4 1.4 1.7 5.2c.2.6.1.8.7.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.4 1.4.2 1.6-.8l2.9-13.6c.3-1.2-.4-1.7-1.2-1.4ZM8.8 13.6l9.6-6c.5-.3.9-.1.5.2l-8 7.3-.3 3.4-1.8-4.9Z"
    />
  </svg>
);

export const MailIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" {...stroke}>
    <rect x="2.5" y="4" width="15" height="12" rx="2.5" />
    <path d="m3 5.5 7 5 7-5" />
  </svg>
);

export const QuestionIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" {...stroke}>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M7.9 7.7a2.2 2.2 0 1 1 3.2 2c-.7.4-1.1.9-1.1 1.6v.3" />
    <circle cx="10" cy="14" r=".4" fill="currentColor" />
  </svg>
);

export const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <path d="M10 3 5 8l5 5" />
  </svg>
);

export const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" {...stroke}>
    <path d="m3 3 8 8M11 3l-8 8" />
  </svg>
);

export const ClipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" {...stroke}>
    <path d="m16.5 9.5-6.4 6.4a4 4 0 0 1-5.7-5.7l6.7-6.7a2.7 2.7 0 0 1 3.8 3.8l-6.7 6.7a1.3 1.3 0 0 1-1.9-1.9l6.2-6.2" />
  </svg>
);

export const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" {...stroke}>
    <path d="m2.5 7.3 3 3 6-6.6" />
  </svg>
);
