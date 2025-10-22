import { differenceInDays, differenceInHours } from 'date-fns';
import type { Interaction } from '../components/types';
import type FriendModel from '../db/models/Friend';
import { calculatePointsForWeave } from './weave-engine';

/**
 * Node size categories for the embroidery timeline
 */
export type NodeSize = 'small' | 'medium' | 'large';

/**
 * Position data for a node on the embroidery path
 */
export interface NodePosition {
  x: number; // Knot position ON the thread
  y: number;
  id: string;
  size: NodeSize;
  interaction: any; // Will hold full interaction data
  cardX: number; // Card position (off the thread, inside curve)
  cardY: number;
  isLeftSide: boolean; // Which side the card is on
}

/**
 * Path segment with styling information
 */
export interface PathSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  controlX: number;
  controlY: number;
  ageInDays: number;
  pathData: string;
}

/**
 * Node size thresholds configuration
 */
export const NodeSizeThresholds = {
  small: { maxPoints: 15, maxNoteLength: 20 },
  medium: { maxPoints: 30, maxNoteLength: 100 },
  large: { minPoints: 30 },
};

/**
 * Calculate the appropriate node size based on interaction properties
 */
export function calculateNodeSize(
  interaction: any,
  friend: FriendModel
): NodeSize {
  // Check if from quick-weave menu
  const isQuickWeave = interaction.source === 'quick-weave';

  // Check for rich content
  const hasNotes = interaction.note && interaction.note.length > 20;
  const hasLongNotes = interaction.note && interaction.note.length > 100;
  const hasPhotos = interaction.photos && interaction.photos.length > 0;

  // Calculate base points
  const basePoints = calculatePointsForWeave(friend, {
    interactionType: interaction.activity,
    duration: interaction.duration,
    vibe: interaction.vibe,
  });

  // Classification logic
  if (isQuickWeave && !hasNotes && !hasPhotos) {
    return 'small'; // Quick touch, minimal info
  }

  if (basePoints > 30 || hasPhotos || hasLongNotes) {
    return 'large'; // Deep weave with rich content
  }

  return 'medium'; // Standard weave
}

/**
 * Get time gap between two interactions in days
 */
function getTimeGapInDays(
  current: any,
  previous: any | null
): number {
  if (!previous) return 0;

  const currentDate = new Date(current.interactionDate);
  const previousDate = new Date(previous.interactionDate);

  return Math.abs(differenceInDays(currentDate, previousDate));
}

/**
 * Generate meandering path with bezier curves for embroidery timeline
 *
 * @param interactions - Sorted array of interactions
 * @param containerWidth - Width of the container
 * @param friend - Friend model for calculating node sizes
 * @returns Path data and node positions
 */
export function generateMeanderingPath(
  interactions: any[],
  containerWidth: number,
  friend: FriendModel
): {
  pathData: string;
  nodePositions: NodePosition[];
  segments: PathSegment[];
  totalHeight: number;
} {
  const centerX = containerWidth / 2;

  // DNA helix-like: tight, compact, subtle curves
  const minVerticalSpacing = 80; // Much tighter than 150px
  const timeSpacingFactor = 15; // Less vertical spread for time gaps
  const helixAmplitude = 30; // Very subtle ±30px oscillation (was ±110px)

  let path = `M ${centerX},50`; // Start slightly below top
  let currentX = centerX;
  let currentY = 50;
  let alternateLeft = true;

  const nodePositions: NodePosition[] = [];
  const segments: PathSegment[] = [];

  interactions.forEach((interaction, i) => {
    const previous = i > 0 ? interactions[i - 1] : null;
    const timeGap = getTimeGapInDays(interaction, previous);

    // Calculate vertical spacing (more time = more space, but still compact)
    const verticalSpacing = Math.max(
      minVerticalSpacing,
      minVerticalSpacing + (timeGap * timeSpacingFactor)
    );

    // DNA helix: regular, predictable, subtle oscillation
    // Simple alternating pattern - no random variation
    const horizontalOffset = helixAmplitude * (alternateLeft ? -1 : 1);
    const targetX = centerX + horizontalOffset;

    // Update Y position
    currentY += verticalSpacing;

    // Very subtle bezier curves - DNA helix has gentle, regular curves
    // Control point creates smooth transition without dramatic sweeps
    const controlX = currentX + (targetX - currentX) * 0.5; // Midpoint transition
    const controlY = currentY - (verticalSpacing * 0.4); // Subtle curve (was 0.7)

    // Add curve to path
    path += ` Q ${controlX},${controlY} ${targetX},${currentY}`;

    // Store segment data
    const ageInDays = differenceInDays(new Date(), new Date(interaction.interactionDate));
    segments.push({
      startX: currentX,
      startY: currentY - verticalSpacing,
      endX: targetX,
      endY: currentY,
      controlX,
      controlY,
      ageInDays,
      pathData: `M ${currentX},${currentY - verticalSpacing} Q ${controlX},${controlY} ${targetX},${currentY}`,
    });

    // Store node position
    const nodeSize = calculateNodeSize(interaction, friend);

    // KNOTS sit ON the thread path at targetX, currentY
    // CARDS branch off to the INSIDE of the curve for space economy
    // "Inside" means toward the center when thread is at edge
    const isMovingRight = targetX > currentX;
    const cardOffsetDirection = isMovingRight ? -1 : 1; // Inside of curve
    const cardOffsetX = cardOffsetDirection * 50; // Closer cards (was 60px)

    nodePositions.push({
      x: targetX, // Knot is ON the thread
      y: currentY,
      id: interaction.id,
      size: nodeSize,
      interaction,
      cardX: targetX + cardOffsetX, // Card position (inside curve)
      cardY: currentY,
      isLeftSide: cardOffsetDirection === -1,
    } as any);

    // Update current position
    currentX = targetX;
    alternateLeft = !alternateLeft;
  });

  return {
    pathData: path,
    nodePositions,
    segments,
    totalHeight: currentY + 100, // Add padding at bottom
  };
}

/**
 * Get thread styling based on age
 * Solid (recent) → Dashed (medium) → Dotted (old)
 */
export function getThreadStyle(ageInDays: number): {
  strokeDasharray: string | null;
  stroke: string;
  strokeWidth: number;
  hasGlow: boolean;
} {
  if (ageInDays < 7) {
    // Recent: Solid golden with glow
    return {
      strokeDasharray: null,
      stroke: 'rgba(212, 175, 55, 0.8)',
      strokeWidth: 2.5,
      hasGlow: true,
    };
  } else if (ageInDays < 30) {
    // Medium: Dashed brown
    return {
      strokeDasharray: '8 6',
      stroke: 'rgba(181, 138, 108, 0.6)',
      strokeWidth: 2,
      hasGlow: false,
    };
  } else {
    // Old: Dotted faded
    return {
      strokeDasharray: '3 10',
      stroke: 'rgba(181, 138, 108, 0.3)',
      strokeWidth: 1.5,
      hasGlow: false,
    };
  }
}

/**
 * Get knot dimensions (small markers ON the thread)
 * All knots are the same small size
 */
export function getKnotDimensions(): {
  width: number;
  height: number;
  radius: number;
} {
  return { width: 6, height: 6, radius: 6 }; // Small circle
}

/**
 * Get card dimensions based on size category
 * Returns { width, height, radius } for different shapes
 */
export function getCardDimensions(size: NodeSize): {
  width: number;
  height: number;
  radius: number; // Border radius for shape
} {
  switch (size) {
    case 'small':
      return { width: 8, height: 8, radius: 8 }; // Tiny circle
    case 'medium':
      return { width: 12, height: 12, radius: 3 }; // Small square
    case 'large':
      return { width: 16, height: 20, radius: 6 }; // Rounded rectangle
    default:
      return { width: 12, height: 12, radius: 3 };
  }
}

/**
 * Calculate warmth factor for node styling (0-1)
 */
export function calculateNodeWarmth(ageInDays: number): number {
  if (ageInDays < 1) return 1.0; // Today
  if (ageInDays < 7) return 0.7; // This week
  if (ageInDays < 30) return 0.4; // This month
  return 0.2; // Older
}
