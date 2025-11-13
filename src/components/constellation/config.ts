/**
 * Constellation Configuration
 * All visual parameters in one place for easy customization
 */

import {
  ParticleConfig,
  RingConfig,
  NodeConfig,
  ConnectionConfig,
  SeasonTheme,
} from './types';
import { SocialSeason } from '../../db/models/UserProfile';

/**
 * Dunbar tier ring radii (from center)
 */
export const RING_RADII = {
  InnerCircle: 80,
  CloseFriends: 150,
  Community: 230,
} as const;

/**
 * Canvas dimensions (default, will be responsive)
 */
export const CANVAS_SIZE = {
  width: 400,
  height: 400,
} as const;

/**
 * Zoom configuration
 */
export const ZOOM_CONFIG = {
  min: 0.5,
  max: 3.0,
  default: 1.0,
  snapPoints: [0.6, 1.0, 1.8], // Snap to these zoom levels
} as const;

/**
 * Particle system configuration by season
 */
export const PARTICLE_CONFIGS: Record<SocialSeason, ParticleConfig> = {
  resting: {
    count: 60,
    minSize: 1,
    maxSize: 2.5,
    minOpacity: 0.2,
    maxOpacity: 0.5,
    speed: 0.3,
    color: '#A5B4FC',
  },
  balanced: {
    count: 80,
    minSize: 1.5,
    maxSize: 3,
    minOpacity: 0.3,
    maxOpacity: 0.6,
    speed: 0.5,
    color: '#EBC867',
  },
  blooming: {
    count: 120,
    minSize: 2,
    maxSize: 4,
    minOpacity: 0.4,
    maxOpacity: 0.8,
    speed: 0.8,
    color: '#C4B5FD',
  },
};

/**
 * Dunbar ring visual configuration
 */
export const RING_CONFIG: RingConfig = {
  radius: 100, // Base, will be overridden per tier
  strokeWidth: 1.5,
  dashArray: [4, 8],
  glowIntensity: 0.3,
  rotationSpeed: 2, // Degrees per second (very slow)
};

/**
 * Friend node configuration
 */
export const NODE_CONFIG: NodeConfig = {
  minSize: 18, // Low score
  maxSize: 32, // High score
  glowRadius: 35,
  glowBlur: 12,
  pulseSpeed: 2000, // 2 seconds
  borderWidth: 2,
};

/**
 * Connection line configuration
 */
export const CONNECTION_CONFIG: ConnectionConfig = {
  minStrokeWidth: 1,
  maxStrokeWidth: 3,
  particleCount: 3, // Flowing particles per line
  particleSpeed: 0.002, // Progress per frame
  waveAmplitude: 3,
  waveFrequency: 0.01,
};

/**
 * Season visual themes
 */
export const SEASON_THEMES: Record<SocialSeason, SeasonTheme> = {
  resting: {
    season: 'resting',
    backgroundColor: ['#1E1B4B', '#312E81', '#1E1B4B'], // Deep indigo gradient
    particleColor: '#A5B4FC',
    ringColor: '#818CF8',
    healthColors: {
      thriving: '#34D399',
      balanced: '#FBBF24',
      fading: '#F87171',
    },
    centerGlow: '#818CF8',
    ambientGlow: '#6366F1',
  },
  balanced: {
    season: 'balanced',
    backgroundColor: ['#451A03', '#78350F', '#451A03'], // Warm amber/brown
    particleColor: '#EBC867',
    ringColor: '#E5BA50',
    healthColors: {
      thriving: '#6EE7B7',
      balanced: '#FCD34D',
      fading: '#FB923C',
    },
    centerGlow: '#EBC867',
    ambientGlow: '#E5BA50',
  },
  blooming: {
    season: 'blooming',
    backgroundColor: ['#3B0764', '#581C87', '#3B0764'], // Rich purple
    particleColor: '#C4B5FD',
    ringColor: '#A78BFA',
    healthColors: {
      thriving: '#A7F3D0',
      balanced: '#FDE68A',
      fading: '#FBBF24',
    },
    centerGlow: '#C4B5FD',
    ambientGlow: '#A78BFA',
  },
};

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATIONS = {
  zoom: 500,
  pan: 400,
  filter: 600,
  nodeAppear: 800,
  particleDrift: 10000,
  ringRotation: 60000, // Full rotation
} as const;

/**
 * Health score thresholds
 */
export const HEALTH_THRESHOLDS = {
  thriving: 70,
  balanced: 40,
} as const;

/**
 * Get health color based on weave score
 */
export function getHealthColor(score: number, theme: SeasonTheme): string {
  if (score >= HEALTH_THRESHOLDS.thriving) {
    return theme.healthColors.thriving;
  }
  if (score >= HEALTH_THRESHOLDS.balanced) {
    return theme.healthColors.balanced;
  }
  return theme.healthColors.fading;
}

/**
 * Calculate node size based on weave score
 */
export function getNodeSize(score: number): number {
  const normalized = Math.max(0, Math.min(100, score)) / 100;
  return NODE_CONFIG.minSize + normalized * (NODE_CONFIG.maxSize - NODE_CONFIG.minSize);
}

/**
 * Calculate connection stroke width based on weave score
 */
export function getConnectionWidth(score: number): number {
  const normalized = Math.max(0, Math.min(100, score)) / 100;
  return (
    CONNECTION_CONFIG.minStrokeWidth +
    normalized * (CONNECTION_CONFIG.maxStrokeWidth - CONNECTION_CONFIG.minStrokeWidth)
  );
}
