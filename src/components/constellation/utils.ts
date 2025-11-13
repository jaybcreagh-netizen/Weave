/**
 * Utility functions for constellation positioning and calculations
 */

import { ConstellationFriend, ConstellationPosition } from './types';
import { RING_RADII, CANVAS_SIZE } from './config';
import { Tier } from '../types';

/**
 * Group friends by Dunbar tier
 */
export function groupFriendsByTier(friends: ConstellationFriend[]) {
  return {
    InnerCircle: friends.filter(f => f.dunbarTier === 'InnerCircle'),
    CloseFriends: friends.filter(f => f.dunbarTier === 'CloseFriends'),
    Community: friends.filter(f => f.dunbarTier === 'Community'),
  };
}

/**
 * Calculate position for a friend node in the constellation
 */
export function calculateFriendPosition(
  friend: ConstellationFriend,
  index: number,
  totalInTier: number,
  centerX: number,
  centerY: number
): ConstellationPosition {
  const radius = RING_RADII[friend.dunbarTier];

  // Distribute friends evenly around the ring
  const angleStep = (2 * Math.PI) / totalInTier;
  const angle = angleStep * index;

  // Add slight random offset for organic feel (deterministic based on friend ID)
  const randomOffset = getSeededRandom(friend.id) * 0.1 - 0.05; // ±5% variation
  const adjustedAngle = angle + randomOffset;

  const x = centerX + radius * Math.cos(adjustedAngle);
  const y = centerY + radius * Math.sin(adjustedAngle);

  return { x, y, angle: adjustedAngle, radius };
}

/**
 * Get all friend positions organized by tier
 */
export function calculateAllPositions(
  friends: ConstellationFriend[],
  centerX: number = CANVAS_SIZE.width / 2,
  centerY: number = CANVAS_SIZE.height / 2
): Map<string, ConstellationPosition> {
  const positionMap = new Map<string, ConstellationPosition>();
  const grouped = groupFriendsByTier(friends);

  // Process each tier
  (['InnerCircle', 'CloseFriends', 'Community'] as Tier[]).forEach(tier => {
    const tierFriends = grouped[tier];
    tierFriends.forEach((friend, index) => {
      const position = calculateFriendPosition(
        friend,
        index,
        tierFriends.length,
        centerX,
        centerY
      );
      positionMap.set(friend.id, position);
    });
  });

  return positionMap;
}

/**
 * Seeded random number generator for deterministic randomness
 * Returns a number between 0 and 1
 */
export function getSeededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(Math.sin(hash));
}

/**
 * Calculate a curved path between two points (for connection lines)
 * Returns an SVG path string
 */
export function getCurvedPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curveFactor: number = 0.2
): string {
  const dx = endX - startX;
  const dy = endY - startY;

  // Control point offset perpendicular to the line
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const offsetX = -dy / distance * curveFactor * distance;
  const offsetY = dx / distance * curveFactor * distance;

  const controlX = midX + offsetX;
  const controlY = midY + offsetY;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Ease in-out cubic function for smooth animations
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Get point along a path at progress t (0-1)
 */
export function getPointOnPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  t: number,
  curveFactor: number = 0.2
): { x: number; y: number } {
  const dx = endX - startX;
  const dy = endY - startY;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const offsetX = -dy / distance * curveFactor * distance;
  const offsetY = dx / distance * curveFactor * distance;

  const controlX = midX + offsetX;
  const controlY = midY + offsetY;

  // Quadratic Bezier curve formula
  const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
  const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;

  return { x, y };
}

/**
 * Calculate opacity for filtered/non-filtered items
 */
export function getFilteredOpacity(isMatching: boolean): number {
  return isMatching ? 1.0 : 0.2;
}

/**
 * Calculate scale for filtered/non-filtered items
 */
export function getFilteredScale(isMatching: boolean): number {
  return isMatching ? 1.1 : 1.0;
}
