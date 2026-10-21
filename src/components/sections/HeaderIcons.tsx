// Линейные иконки 20×20 для шапки авторизованного пользователя (stroke = currentColor)
const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BellIcon = () => (
  <svg {...base}>
    <path d="M5 8.5a5 5 0 0 1 10 0c0 3.6 1.4 5 1.4 5H3.6S5 12.1 5 8.5Z" />
    <path d="M8.3 16.2a1.9 1.9 0 0 0 3.4 0" />
  </svg>
);

export const BoxIcon = () => (
  <svg {...base}>
    <path d="m10 2.8 6.4 3.4v7.6L10 17.2l-6.4-3.4V6.2L10 2.8Z" />
    <path d="M3.8 6.3 10 9.6l6.2-3.3M10 9.6v7.5" />
  </svg>
);

export const GiftIcon = () => (
  <svg {...base}>
    <rect x="3" y="7" width="14" height="3.6" rx="1" />
    <path d="M4.3 10.6v5.2c0 .6.5 1 1 1h9.4c.5 0 1-.4 1-1v-5.2M10 7v9.8M10 7S8.8 3.4 6.6 4.3C4.9 5.1 6.7 7 10 7Zm0 0s1.2-3.6 3.4-2.7c1.7.8-.1 2.7-3.4 2.7Z" />
  </svg>
);

export const UsersIcon = () => (
  <svg {...base}>
    <circle cx="7.6" cy="7" r="3" />
    <path d="M2.5 16.5c.4-2.8 2.6-4.5 5.1-4.5s4.7 1.7 5.1 4.5M13 4.3a3 3 0 0 1 0 5.6M14.6 12.3c1.6.5 2.7 2 2.9 4.2" />
  </svg>
);

export const HeadsetIcon = () => (
  <svg {...base}>
    <path d="M3.5 11.5v-1.8a6.5 6.5 0 0 1 13 0v1.8" />
    <rect x="3" y="11" width="3.2" height="5" rx="1.4" />
    <rect x="13.8" y="11" width="3.2" height="5" rx="1.4" />
  </svg>
);

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3.3v-4.5H7.8V17H4.5a1 1 0 0 1-1-1V9Z" />
  </svg>
);

export const GearIcon = () => (
  <svg {...base}>
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 2.5v2M10 15.5v2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M2.5 10h2M15.5 10h2M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
  </svg>
);

export const LogoutIcon = () => (
  <svg {...base}>
    <path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3M12.5 13.5 16 10l-3.5-3.5M16 10H7.5" />
  </svg>
);

// Монетка со звездой (бонусы)
export const Coin = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
    <circle cx="10" cy="10" r="9" fill="#ffc35a" />
    <circle cx="10" cy="10" r="6.6" fill="#ffa928" />
    <path d="m10 5.9 1.2 2.5 2.7.4-2 1.9.5 2.7L10 12.1l-2.4 1.3.5-2.7-2-1.9 2.7-.4L10 5.9Z" fill="#fff" />
  </svg>
);
