export const themeVariableMap = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  input: "--input",
  ring: "--ring",
  chart1: "--chart-1",
  chart2: "--chart-2",
  chart3: "--chart-3",
  chart4: "--chart-4",
  chart5: "--chart-5",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarAccent: "--sidebar-accent",
  sidebarAccentForeground: "--sidebar-accent-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarRing: "--sidebar-ring",
};

export const colorFieldList = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "card", label: "Card" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "muted", label: "Muted" },
  { key: "border", label: "Border" },
  { key: "input", label: "Input" },
  { key: "ring", label: "Ring" },
  { key: "sidebar", label: "Sidebar" },
];

const darkThemeSeed = {
  background: "#0f172a",
  foreground: "#e5e7eb",
  card: "#111827",
  primary: "#3b82f6",
  secondary: "#1f2937",
  accent: "#2563eb",
  muted: "#0b1220",
  border: "#334155",
  input: "#1e293b",
  ring: "#60a5fa",
  sidebar: "#0b1220",
};

const lightThemeSeed = {
  background: "#ffffff",
  foreground: "#111827",
  card: "#ffffff",
  primary: "#2563eb",
  secondary: "#e5e7eb",
  accent: "#dbeafe",
  muted: "#f3f4f6",
  border: "#d1d5db",
  input: "#e5e7eb",
  ring: "#60a5fa",
  sidebar: "#f8fafc",
};

const normalizeHex = (value) => {
  if (!value) return "#000000";

  let hex = value.trim().replace("#", "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }

  if (hex.length !== 6) {
    return "#000000";
  }

  return `#${hex.toLowerCase()}`;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex).replace("#", "");
  const intValue = parseInt(normalized, 16);

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
};

const getLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);

  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

export const getReadableTextColor = (hex) => {
  const luminance = getLuminance(hex);
  return luminance > 0.5 ? "#111827" : "#ffffff";
};

export const buildThemePalette = (seed) => {
  const background = normalizeHex(seed.background);
  const foreground = normalizeHex(seed.foreground);
  const card = normalizeHex(seed.card);
  const primary = normalizeHex(seed.primary);
  const secondary = normalizeHex(seed.secondary);
  const accent = normalizeHex(seed.accent);
  const muted = normalizeHex(seed.muted);
  const border = normalizeHex(seed.border);
  const input = normalizeHex(seed.input);
  const ring = normalizeHex(seed.ring);
  const sidebar = normalizeHex(seed.sidebar);

  const mutedForeground = mixHexColors(foreground, background, 0.45);

  return {
    background,
    foreground,
    card,
    cardForeground: getReadableTextColor(card),
    popover: card,
    popoverForeground: getReadableTextColor(card),
    primary,
    primaryForeground: getReadableTextColor(primary),
    secondary,
    secondaryForeground: getReadableTextColor(secondary),
    muted,
    mutedForeground,
    accent,
    accentForeground: getReadableTextColor(accent),
    destructive: "#ef4444",
    border,
    input,
    ring,
    chart1: primary,
    chart2: accent,
    chart3: secondary,
    chart4: ring,
    chart5: border,
    sidebar,
    sidebarForeground: getReadableTextColor(sidebar),
    sidebarPrimary: primary,
    sidebarPrimaryForeground: getReadableTextColor(primary),
    sidebarAccent: accent,
    sidebarAccentForeground: getReadableTextColor(accent),
    sidebarBorder: border,
    sidebarRing: ring,
  };
};


export const createEmptyThemeDraft = (mode = "light") => ({
  name: "",
  mode,
  colors: mode === "dark" ? { ...darkThemeSeed } : { ...lightThemeSeed },
});

export const applyThemePalette = (mode, palette) => {
  const root = document.documentElement;

  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.style.colorScheme = mode;

  Object.entries(themeVariableMap).forEach(([key, cssVariable]) => {
    const value = palette[key];
    if (value) {
      root.style.setProperty(cssVariable, value);
    } else {
      root.style.removeProperty(cssVariable);
    }
  });
};

export const getSystemThemeMode = () => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const mixHexColors = (hex1, hex2, weight = 0.5) => {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);

  const mixed = {
    r: Math.round(a.r * (1 - weight) + b.r * weight),
    g: Math.round(a.g * (1 - weight) + b.g * weight),
    b: Math.round(a.b * (1 - weight) + b.b * weight),
  };

  const toHex = (value) => value.toString(16).padStart(2, "0");

  return `#${toHex(mixed.r)}${toHex(mixed.g)}${toHex(mixed.b)}`;
};
