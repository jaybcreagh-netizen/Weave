import type Friend from '@/db/models/Friend';
import type { Vibe } from '@/shared/types/common';

/**
 * Updates the friend's resilience score based on the vibe of an interaction.
 * Resilience changes are only applied after a friend has a minimum number of rated weaves.
 *
 * @param friend - The friend model instance.
 * @param vibe - The vibe of the interaction.
 * @returns The new resilience score, or null if no update was made.
 */
export function updateResilience(
  friend: Friend,
  vibe: Vibe | null
): number | null {
  if (!vibe || friend.ratedWeavesCount < 5) {
    return null; // No update if vibe is not provided or not enough rated weaves
  }

  let newResilience = friend.resilience;

  if (vibe === 'WaxingGibbous' || vibe === 'FullMoon') {
    newResilience += 0.008;
  } else if (vibe === 'NewMoon') {
    newResilience -= 0.005;
  }

  // Clamp the resilience value between 0.8 and 1.5
  const clampedResilience = Math.max(0.8, Math.min(1.5, newResilience));

  // Only return the new value if it has changed
  return clampedResilience !== friend.resilience ? clampedResilience : null;
}
