/**
 * Type definitions for the Constellation View
 */

import { SocialSeason } from '../../db/models/UserProfile';
import { Archetype, Tier } from '../types';

export interface ConstellationFriend {
  id: string;
  name: string;
  avatar?: string;
  dunbarTier: Tier;
  archetype: Archetype;
  weaveScore: number; // 0-100
  hasMomentum: boolean;
  lastInteractionDate?: Date;
}

export interface ConstellationPosition {
  x: number;
  y: number;
  angle: number; // Radians
  radius: number; // Distance from center
}

export interface ParticleConfig {
  count: number;
  minSize: number;
  maxSize: number;
  minOpacity: number;
  maxOpacity: number;
  speed: number; // Multiplier for drift speed
  color: string;
}

export interface RingConfig {
  radius: number;
  strokeWidth: number;
  dashArray?: number[]; // For dashed rings
  glowIntensity: number;
  rotationSpeed: number; // Degrees per second
}

export interface NodeConfig {
  minSize: number;
  maxSize: number;
  glowRadius: number;
  glowBlur: number;
  pulseSpeed: number; // Duration in ms
  borderWidth: number;
}

export interface ConnectionConfig {
  minStrokeWidth: number;
  maxStrokeWidth: number;
  particleCount: number;
  particleSpeed: number;
  waveAmplitude: number;
  waveFrequency: number;
}

export interface SeasonTheme {
  season: SocialSeason;
  backgroundColor: string[];
  particleColor: string;
  ringColor: string;
  healthColors: {
    thriving: string; // 70+
    balanced: string; // 40-70
    fading: string; // <40
  };
  centerGlow: string;
  ambientGlow: string;
}

export type FilterMode = 'all' | 'fading' | 'momentum' | 'tier' | 'archetype';

export interface ConstellationFilter {
  mode: FilterMode;
  value?: Tier | Archetype; // For tier/archetype filters
}
