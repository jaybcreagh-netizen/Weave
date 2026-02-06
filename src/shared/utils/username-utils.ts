/**
 * Username utilities
 *
 * Centralized logic for username validation and temporary username detection.
 * Used by:
 * - UsernameNudgeChannel (notifications)
 * - ProfileCompletionSheet (UI prompt)
 * - createUserProfile (auth service)
 */

/**
 * Pattern for detecting temporary/auto-generated usernames.
 * Matches:
 * - user_1234 (underscore variant)
 * - user1234 (no underscore variant from createUserProfile)
 * - user_12345678 (longer variants)
 *
 * Does NOT match:
 * - usersmith (chosen username that happens to start with "user")
 * - user_jay (chosen username with underscore)
 */
const TEMP_USERNAME_PATTERNS = [
  /^user_\d{4,10}$/i,    // user_1234, user_12345678
  /^user\d{1,10}$/i,     // user123, user12345 (from createUserProfile)
];

/**
 * Check if a username is a temporary/auto-generated one.
 *
 * @param username - The username to check (can be null/undefined)
 * @returns true if the username is missing or matches a temporary pattern
 */
export function isTemporaryUsername(username?: string | null): boolean {
  if (!username) return true;

  const trimmed = username.trim();
  if (!trimmed) return true;

  return TEMP_USERNAME_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a username is valid (claimed by the user).
 * Inverse of isTemporaryUsername for readability.
 *
 * @param username - The username to check
 * @returns true if the username is a real, user-chosen handle
 */
export function hasClaimedUsername(username?: string | null): boolean {
  return !isTemporaryUsername(username);
}
