/**
 * Validation Helpers
 *
 * Utility functions for data validation and sanitization across the app.
 * Used to ensure data integrity and prevent invalid values.
 */

/**
 * Validation bounds for Friend model numeric fields
 */
export const FRIEND_VALIDATION_BOUNDS = {
  weaveScore: { min: 0, max: 100 },
  resilience: { min: 0.8, max: 1.5 },
  momentumScore: { min: 0, max: 100 },
  ratedWeavesCount: { min: 0, max: Number.MAX_SAFE_INTEGER },
  initiationRatio: { min: 0.0, max: 1.0 },
  consecutiveUserInitiations: { min: 0, max: 999 },
  totalUserInitiations: { min: 0, max: Number.MAX_SAFE_INTEGER },
  totalFriendInitiations: { min: 0, max: Number.MAX_SAFE_INTEGER },
  typicalIntervalDays: { min: 0, max: 365 },
  toleranceWindowDays: { min: 0, max: 180 },
  outcomeCount: { min: 0, max: Number.MAX_SAFE_INTEGER },
};

/**
 * Clamps a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Validates and sanitizes a Friend model numeric field
 * @param value The value to validate
 * @param fieldName The name of the field being validated
 * @returns The sanitized value, or null if invalid
 */
export function validateFriendNumericField(
  value: number | null | undefined,
  fieldName: keyof typeof FRIEND_VALIDATION_BOUNDS
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Check if value is a valid number
  if (!Number.isFinite(value)) {
    console.warn(`[Validation] Invalid ${fieldName}: ${value}, returning null`);
    return null;
  }

  const bounds = FRIEND_VALIDATION_BOUNDS[fieldName];
  if (!bounds) {
    console.warn(`[Validation] No bounds defined for field: ${fieldName}`);
    return value;
  }

  // Clamp to valid range
  const clamped = clamp(value, bounds.min, bounds.max);

  // Warn if value was out of bounds
  if (clamped !== value) {
    console.warn(
      `[Validation] ${fieldName} out of bounds: ${value}, clamped to ${clamped} (range: ${bounds.min}-${bounds.max})`
    );
  }

  return clamped;
}

/**
 * Validates a date string in MM-DD format
 * @param dateString The date string to validate (e.g., "03-15")
 * @returns true if valid, false otherwise
 */
export function validateMMDDFormat(dateString: string | null | undefined): boolean {
  if (!dateString) return false;

  // Expected format: MM-DD (e.g., "03-15" for March 15)
  const regex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  return regex.test(dateString);
}

/**
 * Validates a percentage value (0-100)
 * @param value The value to validate
 * @returns The clamped value between 0 and 100
 */
export function validatePercentage(value: number): number {
  return clamp(value, 0, 100);
}

/**
 * Validates a ratio value (0.0-1.0)
 * @param value The value to validate
 * @returns The clamped value between 0 and 1
 */
export function validateRatio(value: number): number {
  return clamp(value, 0.0, 1.0);
}

/**
 * Sanitizes a string for database storage
 * - Trims whitespace
 * - Removes null characters
 * - Limits length
 */
export function sanitizeString(
  value: string | null | undefined,
  maxLength: number = 255
): string {
  if (!value) return '';

  return value
    .trim()
    .replace(/\0/g, '') // Remove null characters
    .slice(0, maxLength);
}

/**
 * Validates that a value is one of the allowed values
 */
export function validateEnum<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  if (!value) return defaultValue;

  if (allowedValues.includes(value as T)) {
    return value as T;
  }

  console.warn(
    `[Validation] Invalid enum value: ${value}, expected one of: ${allowedValues.join(', ')}`
  );
  return defaultValue;
}
