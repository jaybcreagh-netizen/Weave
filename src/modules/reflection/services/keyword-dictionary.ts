import { type InteractionCategory } from '@/components/types';

/**
 * Event type classification
 */
export type EventType =
  | 'birthday'
  | 'anniversary'
  | 'holiday'
  | 'social'
  | 'meal'
  | 'activity'
  | 'meeting'
  | 'unknown';

/**
 * Event importance level
 */
export type EventImportance = 'critical' | 'high' | 'medium' | 'low';

/**
 * Pattern for matching calendar event titles
 */
export interface EventPattern {
  type: EventType;
  patterns: RegExp[];
  importance: EventImportance;
  suggestedCategory?: InteractionCategory;
  keywords: string[]; // For fuzzy fallback matching
}

/**
 * Comprehensive keyword patterns for calendar event recognition
 * Patterns are case-insensitive and match partial words
 */
export const EVENT_PATTERNS: EventPattern[] = [
  // BIRTHDAYS - Critical importance
  {
    type: 'birthday',
    importance: 'critical',
    suggestedCategory: 'birthday',
    patterns: [
      /\bbirthday\b/i,
      /\bbday\b/i,
      /\bb-day\b/i,
      /🎂/,
      /🎉.*birthday/i,
      /birthday.*party/i,
      /\bborn\b.*day/i,
      /\bturns?\b.*\d+/i, // "turns 30", "turn 25"
    ],
    keywords: ['birthday', 'bday', 'b-day', 'born'],
  },

  // ANNIVERSARIES - High importance
  {
    type: 'anniversary',
    importance: 'high',
    suggestedCategory: 'milestone',
    patterns: [
      /\banniversary\b/i,
      /\byear.*together\b/i,
      /\d+.*years?.*\b(married|together|dating)\b/i,
      /💍/,
      /wedding.*anniversary/i,
    ],
    keywords: ['anniversary', 'together', 'married', 'dating'],
  },

  // MAJOR HOLIDAYS - High importance
  {
    type: 'holiday',
    importance: 'high',
    suggestedCategory: 'holiday',
    patterns: [
      /\bchristmas\b/i,
      /\bxmas\b/i,
      /\bthanksgiving\b/i,
      /\bnewyear\b/i,
      /\bnew year\b/i,
      /\beaster\b/i,
      /\bhalloween\b/i,
      /\bvalentine/i,
      /\bmother.*day\b/i,
      /\bfather.*day\b/i,
      /\bhanukkah\b/i,
      /\bdiwali\b/i,
      /\bramadan\b/i,
      /🎄|🎃|💝|🕎/,
    ],
    keywords: ['christmas', 'thanksgiving', 'easter', 'halloween', 'holiday'],
  },

  // MEALS - Medium importance, maps to specific categories
  {
    type: 'meal',
    importance: 'medium',
    patterns: [
      /\bdinner\b(?!.*party)/i, // dinner but not dinner party
      /\blunch\b/i,
      /\bbrunch\b/i,
      /\bbreakfast\b/i,
      /\bcoffee\b/i,
      /\bdrinks?\b/i,
      /\bbeer\b/i,
      /\bwine\b/i,
      /\bbar\b/i,
      /\brestaurant\b/i,
      /☕|🍺|🍷|🍽️/,
    ],
    keywords: ['dinner', 'lunch', 'brunch', 'breakfast', 'coffee', 'drinks'],
    suggestedCategory: 'meal',
  },

  // SOCIAL GATHERINGS - Medium to High importance
  {
    type: 'social',
    importance: 'medium',
    patterns: [
      /\bdinner.*party\b/i,
      /\bparty\b/i,
      /\bget.*together\b/i,
      /\bhang.*out\b/i,
      /\bgathering\b/i,
      /\bsocial\b/i,
      /\breunion\b/i,
      /\bcelebration\b/i,
      /🎉|🎊/,
    ],
    keywords: ['party', 'gathering', 'celebration', 'hangout', 'reunion'],
    suggestedCategory: 'party',
  },

  // ACTIVITIES - Medium importance
  {
    type: 'activity',
    importance: 'medium',
    patterns: [
      /\bgame.*night\b/i,
      /\bmovie\b/i,
      /\bfilm\b/i,
      /\bcinema\b/i,
      /\bconcert\b/i,
      /\bshow\b/i,
      /\btheater\b/i,
      /\btheatre\b/i,
      /\bgym\b/i,
      /\bworkout\b/i,
      /\bhike\b/i,
      /\bhiking\b/i,
      /\bwalk\b/i,
      /\brun\b/i,
      /\bsports?\b/i,
      /\bgolf\b/i,
      /\btennis\b/i,
      /\bswim\b/i,
      /\byoga\b/i,
      /\bmuseum\b/i,
      /\bexhibit\b/i,
      /\bart\b/i,
      /\bgallery\b/i,
      /🎮|🎬|🎵|🏃|⛰️|🎨/,
    ],
    keywords: ['game', 'movie', 'concert', 'hike', 'sports', 'museum', 'art'],
    suggestedCategory: 'event',
  },

  // MEETINGS/CALLS - Low importance (more professional)
  {
    type: 'meeting',
    importance: 'low',
    patterns: [
      /\bmeeting\b/i,
      /\bcall\b/i,
      /\bvideo.*call\b/i,
      /\bzoom\b/i,
      /\bcatch.*up\b/i,
      /\bcheck.*in\b/i,
      /\bchat\b/i,
      /📞|💬|📹/,
    ],
    keywords: ['meeting', 'call', 'zoom', 'chat', 'catch up'],
    suggestedCategory: 'call',
  },
];

/**
 * Major holidays with fixed dates (for date-based matching)
 */
export interface HolidayDate {
  name: string;
  month: number; // 0-indexed (0 = January)
  day: number;
  importance: EventImportance;
}

export const FIXED_HOLIDAYS: HolidayDate[] = [
  { name: "New Year's Day", month: 0, day: 1, importance: 'high' },
  { name: "Valentine's Day", month: 1, day: 14, importance: 'medium' },
  { name: "St. Patrick's Day", month: 2, day: 17, importance: 'medium' },
  { name: "Halloween", month: 9, day: 31, importance: 'high' },
  { name: "Christmas Eve", month: 11, day: 24, importance: 'high' },
  { name: "Christmas", month: 11, day: 25, importance: 'critical' },
  { name: "New Year's Eve", month: 11, day: 31, importance: 'high' },
];

/**
 * Analyze an event title and classify it
 * Returns matched pattern and confidence score (0-1)
 */
export function classifyEvent(
  title: string
): { type: EventType; importance: EventImportance; suggestedCategory?: InteractionCategory; confidence: number } | null {
  if (!title || title.trim().length === 0) {
    return null;
  }

  const titleLower = title.toLowerCase();

  // Try pattern matching first (high confidence)
  for (const pattern of EVENT_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(title)) {
        return {
          type: pattern.type,
          importance: pattern.importance,
          suggestedCategory: pattern.suggestedCategory,
          confidence: 0.9, // High confidence for regex match
        };
      }
    }
  }

  // Fallback: keyword matching (medium confidence)
  for (const pattern of EVENT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (titleLower.includes(keyword)) {
        return {
          type: pattern.type,
          importance: pattern.importance,
          suggestedCategory: pattern.suggestedCategory,
          confidence: 0.6, // Lower confidence for simple keyword match
        };
      }
    }
  }

  return null;
}

/**
 * Check if a date matches a known holiday
 */
export function matchHolidayDate(date: Date): HolidayDate | null {
  const month = date.getMonth();
  const day = date.getDate();

  return FIXED_HOLIDAYS.find((holiday) => holiday.month === month && holiday.day === day) || null;
}

/**
 * Extract potential friend names from event title
 * Returns array of possible names (e.g., "Coffee with Sarah" -> ["Sarah"])
 */
export function extractNamesFromTitle(title: string): string[] {
  if (!title || title.trim().length === 0) {
    return [];
  }

  const names: string[] = [];

  // Common patterns for names in event titles
  const patterns = [
    /\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, // "with Sarah", "with John Smith"
    /\band\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g, // "and Sarah"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'?s?\s+birthday/gi, // "Sarah's birthday"
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*-/g, // "Sarah - Coffee"
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\w+/g, // "Sarah Coffee" (first word capitalized)
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(title)) !== null) {
      const name = match[1].trim();
      // Avoid common false positives
      const excludeWords = [
        'The',
        'A',
        'An',
        'To',
        'From',
        'For',
        'With',
        'And',
        'Or',
        'But',
        'In',
        'On',
        'At',
        'By',
        'Happy',
        'Party',
        'Meeting',
        'Call',
        'Zoom',
        'Video',
        'Coffee',
        'Dinner',
        'Lunch',
      ];
      if (!excludeWords.includes(name) && name.length >= 2) {
        names.push(name);
      }
    }
  }

  // Remove duplicates
  return [...new Set(names)];
}
