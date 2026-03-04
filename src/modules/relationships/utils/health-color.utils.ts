export interface FriendHealthGradient {
  colors: [string, string];
  opacity: number;
}

interface FriendHealthColorStop {
  score: number;
  colors: [string, string];
  opacity: number;
}

const SCORE_MIN = 0;
const SCORE_MAX = 100;

// User-facing score anchors to keep color semantics stable,
// while allowing smooth interpolation between each value.
const HEALTH_SCORE_ANCHORS = [100, 75, 60, 50, 30, 20, 10] as const;

const LIGHT_MODE_HEALTH_STOPS: readonly FriendHealthColorStop[] = [
  { score: 100, colors: ['#059669', '#10B981'], opacity: 0.20 },
  { score: 75, colors: ['#22C55E', '#4ADE80'], opacity: 0.22 },
  { score: 60, colors: ['#84CC16', '#A3E635'], opacity: 0.24 },
  { score: 50, colors: ['#D97706', '#F59E0B'], opacity: 0.26 },
  { score: 30, colors: ['#78716C', '#A8A29E'], opacity: 0.29 },
  { score: 20, colors: ['#57534E', '#78716C'], opacity: 0.32 },
  { score: 10, colors: ['#44403C', '#57534E'], opacity: 0.34 },
  // Safety floor below the lowest anchor.
  { score: 0, colors: ['#292524', '#44403C'], opacity: 0.35 },
] as const;

const DARK_MODE_HEALTH_STOPS: readonly FriendHealthColorStop[] = [
  { score: 100, colors: ['#10B981', '#34D399'], opacity: 0.22 },
  { score: 75, colors: ['#22C55E', '#4ADE80'], opacity: 0.24 },
  { score: 60, colors: ['#A3E635', '#BEF264'], opacity: 0.26 },
  { score: 50, colors: ['#F59E0B', '#FBBF24'], opacity: 0.28 },
  { score: 30, colors: ['#6B7280', '#9CA3AF'], opacity: 0.31 },
  { score: 20, colors: ['#4B5563', '#6B7280'], opacity: 0.34 },
  { score: 10, colors: ['#374151', '#4B5563'], opacity: 0.36 },
  // Safety floor below the lowest anchor.
  { score: 0, colors: ['#1F2937', '#374151'], opacity: 0.37 },
] as const;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const normalizeHex = (hex: string): string => {
  const value = hex.trim().replace('#', '');

  if (value.length === 3) {
    return value
      .split('')
      .map((char) => `${char}${char}`)
      .join('');
  }

  return value;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = normalizeHex(hex);

  if (normalized.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const intValue = Number.parseInt(normalized, 16);

  return [
    (intValue >> 16) & 255,
    (intValue >> 8) & 255,
    intValue & 255,
  ];
};

const rgbToHex = (rgb: [number, number, number]): string => {
  const [r, g, b] = rgb.map((channel) => clamp(Math.round(channel), 0, 255));
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
};

const mix = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor;
};

const interpolateHex = (startHex: string, endHex: string, factor: number): string => {
  const t = clamp(factor, 0, 1);
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);

  return rgbToHex([
    mix(start[0], end[0], t),
    mix(start[1], end[1], t),
    mix(start[2], end[2], t),
  ]);
};

const interpolateBetweenStops = (
  score: number,
  upper: FriendHealthColorStop,
  lower: FriendHealthColorStop
): FriendHealthGradient => {
  const scoreRange = upper.score - lower.score;
  const factor = scoreRange > 0 ? (score - lower.score) / scoreRange : 0;

  return {
    colors: [
      interpolateHex(lower.colors[0], upper.colors[0], factor),
      interpolateHex(lower.colors[1], upper.colors[1], factor),
    ],
    opacity: mix(lower.opacity, upper.opacity, factor),
  };
};

const findGradientForScore = (
  score: number,
  stops: readonly FriendHealthColorStop[]
): FriendHealthGradient => {
  const clampedScore = clamp(Number.isFinite(score) ? score : 0, SCORE_MIN, SCORE_MAX);

  const highest = stops[0];
  const lowest = stops[stops.length - 1];

  if (clampedScore >= highest.score) {
    return { colors: highest.colors, opacity: highest.opacity };
  }

  if (clampedScore <= lowest.score) {
    return { colors: lowest.colors, opacity: lowest.opacity };
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const upper = stops[i];
    const lower = stops[i + 1];

    if (clampedScore <= upper.score && clampedScore >= lower.score) {
      return interpolateBetweenStops(clampedScore, upper, lower);
    }
  }

  return { colors: lowest.colors, opacity: lowest.opacity };
};

export function getFriendHealthGradient(score: number, isDarkMode: boolean): FriendHealthGradient {
  const stops = isDarkMode ? DARK_MODE_HEALTH_STOPS : LIGHT_MODE_HEALTH_STOPS;
  return findGradientForScore(score, stops);
}

export { HEALTH_SCORE_ANCHORS };
