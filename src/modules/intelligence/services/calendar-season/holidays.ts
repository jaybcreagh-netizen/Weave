/**
 * Holiday Database
 *
 * Defines holidays and special occasions that can trigger
 * seasonal suggestions and prompts.
 */

export type HolidayCategory =
  | 'major'           // Big holidays (Christmas, New Year)
  | 'relationship'    // Connection-focused (Valentine's, Mother's Day)
  | 'gratitude'       // Thanksgiving, appreciation occasions
  | 'cultural'        // Cultural celebrations
  | 'seasonal';       // Season changes (solstices, etc.)

export type HolidayRegion = 'global' | 'US' | 'UK' | 'AU' | 'EU';

export interface Holiday {
  id: string;
  name: string;
  /** Fixed date in MM-DD format, or 'dynamic' for calculated dates */
  date: string;
  /** For dynamic dates, a function key to calculate */
  dynamicDateKey?: string;
  category: HolidayCategory;
  regions: HolidayRegion[];
  /** Days before to start showing suggestions */
  leadTimeDays: number;
  /** Connection prompt for this holiday */
  connectionPrompt: string;
  /** Shorter notification-friendly message */
  shortPrompt: string;
  /** Icon name from lucide */
  icon: string;
  /** Whether this is enabled by default */
  defaultEnabled: boolean;
}

/**
 * Dynamic date calculators for holidays that move each year
 */
export const DYNAMIC_DATE_CALCULATORS: Record<string, (year: number) => Date> = {
  // US Thanksgiving: 4th Thursday of November
  'thanksgiving-us': (year: number) => {
    const nov1 = new Date(year, 10, 1); // November
    const dayOfWeek = nov1.getDay();
    const firstThursday = dayOfWeek <= 4 ? 5 - dayOfWeek : 12 - dayOfWeek;
    return new Date(year, 10, firstThursday + 21); // 4th Thursday
  },

  // Mother's Day US: 2nd Sunday of May
  'mothers-day-us': (year: number) => {
    const may1 = new Date(year, 4, 1);
    const dayOfWeek = may1.getDay();
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return new Date(year, 4, firstSunday + 7); // 2nd Sunday
  },

  // Father's Day US: 3rd Sunday of June
  'fathers-day-us': (year: number) => {
    const june1 = new Date(year, 5, 1);
    const dayOfWeek = june1.getDay();
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return new Date(year, 5, firstSunday + 14); // 3rd Sunday
  },

  // Easter: Complex calculation (Computus algorithm)
  'easter': (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
  },
};

/**
 * Core holiday database
 */
export const HOLIDAYS: Holiday[] = [
  // Major Global Holidays
  {
    id: 'new-years-day',
    name: "New Year's Day",
    date: '01-01',
    category: 'major',
    regions: ['global'],
    leadTimeDays: 7,
    connectionPrompt: "A new year begins. Who would you love to carry forward into this chapter with intention?",
    shortPrompt: "Start the year with meaningful connection",
    icon: 'Sparkles',
    defaultEnabled: true,
  },
  {
    id: 'new-years-eve',
    name: "New Year's Eve",
    date: '12-31',
    category: 'major',
    regions: ['global'],
    leadTimeDays: 5,
    connectionPrompt: "The year is closing. Is there someone you'd like to reconnect with before it ends?",
    shortPrompt: "Close the year with a meaningful connection",
    icon: 'PartyPopper',
    defaultEnabled: true,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    date: '12-25',
    category: 'major',
    regions: ['global'],
    leadTimeDays: 14,
    connectionPrompt: "The holiday season is here. Who brings warmth to your life that you'd like to appreciate?",
    shortPrompt: "Spread holiday warmth to someone special",
    icon: 'Gift',
    defaultEnabled: true,
  },
  {
    id: 'christmas-eve',
    name: 'Christmas Eve',
    date: '12-24',
    category: 'major',
    regions: ['global'],
    leadTimeDays: 7,
    connectionPrompt: "Christmas Eve approaches. A quiet moment to reach out to someone you cherish.",
    shortPrompt: "Share a quiet holiday moment",
    icon: 'Star',
    defaultEnabled: true,
  },

  // Relationship-Focused Holidays
  {
    id: 'valentines-day',
    name: "Valentine's Day",
    date: '02-14',
    category: 'relationship',
    regions: ['global'],
    leadTimeDays: 7,
    connectionPrompt: "Valentine's Day celebrates all forms of love. Who deserves to know they matter to you?",
    shortPrompt: "Celebrate the love in your life",
    icon: 'Heart',
    defaultEnabled: true,
  },
  {
    id: 'galentines-day',
    name: "Galentine's Day",
    date: '02-13',
    category: 'relationship',
    regions: ['global'],
    leadTimeDays: 5,
    connectionPrompt: "Galentine's Day celebrates friendship. Reach out to a friend who lifts you up.",
    shortPrompt: "Celebrate your friendships",
    icon: 'Users',
    defaultEnabled: true,
  },
  {
    id: 'mothers-day-us',
    name: "Mother's Day",
    date: 'dynamic',
    dynamicDateKey: 'mothers-day-us',
    category: 'relationship',
    regions: ['US', 'AU'],
    leadTimeDays: 7,
    connectionPrompt: "Mother's Day is coming. A moment to honor the maternal figures in your life.",
    shortPrompt: "Honor the nurturing souls in your life",
    icon: 'Heart',
    defaultEnabled: true,
  },
  {
    id: 'fathers-day-us',
    name: "Father's Day",
    date: 'dynamic',
    dynamicDateKey: 'fathers-day-us',
    category: 'relationship',
    regions: ['US', 'UK'],
    leadTimeDays: 7,
    connectionPrompt: "Father's Day approaches. Time to appreciate the paternal figures who shaped you.",
    shortPrompt: "Appreciate the father figures in your life",
    icon: 'Heart',
    defaultEnabled: true,
  },
  {
    id: 'friendship-day',
    name: 'International Friendship Day',
    date: '07-30',
    category: 'relationship',
    regions: ['global'],
    leadTimeDays: 5,
    connectionPrompt: "It's Friendship Day! Who's a friend you've been meaning to reach out to?",
    shortPrompt: "Celebrate your friendships today",
    icon: 'Users',
    defaultEnabled: true,
  },

  // Gratitude Holidays
  {
    id: 'thanksgiving-us',
    name: 'Thanksgiving',
    date: 'dynamic',
    dynamicDateKey: 'thanksgiving-us',
    category: 'gratitude',
    regions: ['US'],
    leadTimeDays: 10,
    connectionPrompt: "Thanksgiving reminds us to appreciate our people. Who are you grateful for?",
    shortPrompt: "Express gratitude to someone special",
    icon: 'Heart',
    defaultEnabled: true,
  },
  {
    id: 'world-gratitude-day',
    name: 'World Gratitude Day',
    date: '09-21',
    category: 'gratitude',
    regions: ['global'],
    leadTimeDays: 3,
    connectionPrompt: "Today celebrates gratitude. Who deserves to know you appreciate them?",
    shortPrompt: "Share your gratitude with someone",
    icon: 'Smile',
    defaultEnabled: true,
  },

  // Cultural/Seasonal
  {
    id: 'lunar-new-year',
    name: 'Lunar New Year',
    date: '01-29', // Approximate - varies each year
    category: 'cultural',
    regions: ['global'],
    leadTimeDays: 7,
    connectionPrompt: "Lunar New Year brings renewal. Who would you like to wish prosperity and joy?",
    shortPrompt: "Wish someone a prosperous new year",
    icon: 'Moon',
    defaultEnabled: false, // Opt-in since date varies
  },
  {
    id: 'easter',
    name: 'Easter',
    date: 'dynamic',
    dynamicDateKey: 'easter',
    category: 'cultural',
    regions: ['global'],
    leadTimeDays: 7,
    connectionPrompt: "Easter brings themes of renewal and togetherness. Connect with family or friends.",
    shortPrompt: "Reconnect this Easter",
    icon: 'Egg',
    defaultEnabled: false, // Opt-in
  },
  {
    id: 'diwali',
    name: 'Diwali',
    date: '11-01', // Approximate - varies each year
    category: 'cultural',
    regions: ['global'],
    leadTimeDays: 7,
    connectionPrompt: "Diwali, the festival of lights, celebrates new beginnings. Brighten someone's day.",
    shortPrompt: "Share light with someone today",
    icon: 'Flame',
    defaultEnabled: false, // Opt-in
  },

  // Seasonal Markers
  {
    id: 'winter-solstice',
    name: 'Winter Solstice',
    date: '12-21',
    category: 'seasonal',
    regions: ['global'],
    leadTimeDays: 3,
    connectionPrompt: "The darkest day invites us to seek warmth in each other. Who brings light to your life?",
    shortPrompt: "Find warmth in connection",
    icon: 'Snowflake',
    defaultEnabled: true,
  },
  {
    id: 'summer-solstice',
    name: 'Summer Solstice',
    date: '06-21',
    category: 'seasonal',
    regions: ['global'],
    leadTimeDays: 3,
    connectionPrompt: "The longest day is here. Make the most of it with someone you enjoy.",
    shortPrompt: "Celebrate the long days together",
    icon: 'Sun',
    defaultEnabled: true,
  },
  {
    id: 'spring-equinox',
    name: 'Spring Equinox',
    date: '03-20',
    category: 'seasonal',
    regions: ['global'],
    leadTimeDays: 3,
    connectionPrompt: "Spring awakens new growth. Is there a friendship ready to bloom again?",
    shortPrompt: "Let a friendship bloom",
    icon: 'Flower2',
    defaultEnabled: true,
  },
  {
    id: 'autumn-equinox',
    name: 'Autumn Equinox',
    date: '09-22',
    category: 'seasonal',
    regions: ['global'],
    leadTimeDays: 3,
    connectionPrompt: "As autumn settles, we tend to turn inward. Who do you want close this season?",
    shortPrompt: "Draw closer as the season changes",
    icon: 'Leaf',
    defaultEnabled: true,
  },
];

/**
 * Get all holidays enabled by default
 */
export function getDefaultEnabledHolidays(): Holiday[] {
  return HOLIDAYS.filter(h => h.defaultEnabled);
}

/**
 * Get holidays for a specific region
 */
export function getHolidaysForRegion(region: HolidayRegion): Holiday[] {
  return HOLIDAYS.filter(h => h.regions.includes(region) || h.regions.includes('global'));
}

/**
 * Get holiday by ID
 */
export function getHolidayById(id: string): Holiday | undefined {
  return HOLIDAYS.find(h => h.id === id);
}
