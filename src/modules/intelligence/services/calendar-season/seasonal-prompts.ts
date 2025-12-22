/**
 * Seasonal Prompts
 *
 * Context-aware prompts for notifications, reflections, and suggestions
 * based on calendar season and upcoming holidays.
 */

import { CalendarSeason, getCurrentCalendarSeason, getNextActionableHoliday, UpcomingHoliday } from './calendar-season.service';
import { Archetype } from '@/shared/types/common';

export interface SeasonalPromptContext {
  calendarSeason: CalendarSeason;
  upcomingHoliday: UpcomingHoliday | null;
  isHighConnectionPeriod: boolean;
}

/**
 * Get seasonal reflection prompts for weekly reflection
 */
export function getSeasonalReflectionPrompts(now: Date = new Date()): string[] {
  const { season } = getCurrentCalendarSeason(now);
  const holiday = getNextActionableHoliday({ now });

  const prompts: string[] = [];

  // Season-specific prompts
  const seasonPrompts: Record<CalendarSeason, string[]> = {
    winter: [
      "Winter invites deeper connection. Who would you like to cozy up with?",
      "The slower pace of winter is perfect for meaningful one-on-ones.",
      "Cold days, warm hearts. Who warms yours?",
    ],
    spring: [
      "Spring is for renewal. Is there a friendship ready to bloom again?",
      "New energy is in the air. Who might you reconnect with?",
      "As nature awakens, consider reaching out to someone new.",
    ],
    summer: [
      "Long summer days create space for spontaneous adventures.",
      "Summer's ease is perfect for casual hangouts.",
      "Who would you love to share a summer evening with?",
    ],
    autumn: [
      "As we turn inward, who do you want close this season?",
      "Autumn invites gratitude. Who are you thankful for?",
      "The coziness of fall pairs well with deep conversations.",
    ],
  };

  prompts.push(...seasonPrompts[season]);

  // Holiday-specific prompts
  if (holiday?.isWithinLeadTime) {
    if (holiday.daysUntil === 0) {
      prompts.unshift(`It's ${holiday.holiday.name}! ${holiday.holiday.shortPrompt}`);
    } else if (holiday.daysUntil <= 3) {
      prompts.unshift(`${holiday.holiday.name} is ${holiday.daysUntil === 1 ? 'tomorrow' : `in ${holiday.daysUntil} days`}. ${holiday.holiday.connectionPrompt}`);
    } else {
      prompts.unshift(holiday.holiday.connectionPrompt);
    }
  }

  return prompts;
}

/**
 * Get a contextual notification message based on season/holiday
 */
export function getSeasonalNotificationMessage(
  baseMessage: string,
  now: Date = new Date()
): string {
  const holiday = getNextActionableHoliday({ now });

  // If there's a holiday today or tomorrow, enhance the message
  if (holiday?.isToday) {
    return `🎉 ${holiday.holiday.name}: ${baseMessage}`;
  }

  if (holiday?.isTomorrow) {
    return `${holiday.holiday.name} tomorrow: ${baseMessage}`;
  }

  return baseMessage;
}

/**
 * Get archetype-aware holiday suggestion
 * Combines the friend's archetype with the holiday context
 */
export function getArchetypeHolidaySuggestion(
  archetype: Archetype,
  holidayName: string
): string {
  const archetypeSuggestions: Record<Archetype, string> = {
    Sun: `Celebrate ${holidayName} together with shared joy and festivities`,
    Hermit: `A quiet, one-on-one ${holidayName} moment could be meaningful`,
    Emperor: `Plan ahead for a ${holidayName} meetup that honors your rhythm`,
    Fool: `Surprise them with a spontaneous ${holidayName} adventure`,
    Empress: `Show you care with a thoughtful ${holidayName} gesture`,
    Magician: `Create something special together for ${holidayName}`,
    HighPriestess: `Share a deep, reflective conversation this ${holidayName}`,
    Lovers: `Connect heart-to-heart during ${holidayName}`,
    Unknown: `Reach out and connect during ${holidayName}`,
  };

  return archetypeSuggestions[archetype] || archetypeSuggestions.Unknown;
}

/**
 * Get seasonal battery check-in prompts
 */
export function getSeasonalBatteryPrompt(now: Date = new Date()): string {
  const { season } = getCurrentCalendarSeason(now);
  const holiday = getNextActionableHoliday({ now });

  // Holiday-specific battery prompts
  if (holiday?.isWithinLeadTime && holiday.daysUntil <= 5) {
    const holidayPrompts: Record<string, string> = {
      'christmas': "The holidays can be both joyful and draining. How's your social energy?",
      'thanksgiving-us': "Thanksgiving gatherings can be a lot. Check in with your energy.",
      'new-years-eve': "Big celebrations ahead—pace yourself. How are you feeling?",
      'valentines-day': "Love is in the air. How's your heart and energy today?",
    };

    return holidayPrompts[holiday.holiday.id] || `${holiday.holiday.name} is coming. How's your energy?`;
  }

  // Season-specific battery prompts
  const seasonBatteryPrompts: Record<CalendarSeason, string[]> = {
    winter: [
      "Winter can deplete us. How's your social battery today?",
      "Cold days call for honoring your energy. How are you?",
      "Winter hibernation is valid. What's your capacity today?",
    ],
    spring: [
      "Spring energy can be invigorating. How are you feeling?",
      "New season, fresh start. What's your social capacity?",
      "As the world wakes up, how's your energy?",
    ],
    summer: [
      "Summer's busy. Don't forget to recharge. How's your battery?",
      "Long days can mean long socializing. How are you feeling?",
      "Summer heat can drain us. Check in with your energy.",
    ],
    autumn: [
      "As we slow down with autumn, how's your energy?",
      "Cozy season invites rest. What's your capacity today?",
      "Autumn asks us to turn inward. How are you feeling?",
    ],
  };

  const prompts = seasonBatteryPrompts[season];
  return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Get seasonal evening digest intro
 */
export function getSeasonalDigestIntro(now: Date = new Date()): string {
  const { season } = getCurrentCalendarSeason(now);
  const holiday = getNextActionableHoliday({ now });

  if (holiday?.isToday) {
    return `Happy ${holiday.holiday.name}! Here's your evening reflection.`;
  }

  if (holiday?.isTomorrow) {
    return `${holiday.holiday.name} eve. Here's how your connections are doing.`;
  }

  const seasonIntros: Record<CalendarSeason, string> = {
    winter: "A cozy winter evening for reflection.",
    spring: "Spring evening check-in on your connections.",
    summer: "Summer evening—here's how your weave looks.",
    autumn: "Autumn evening reflection time.",
  };

  return seasonIntros[season];
}

/**
 * Get holiday-specific suggestion title
 */
export function getHolidaySuggestionTitle(
  friendName: string,
  holiday: UpcomingHoliday
): string {
  if (holiday.isToday) {
    return `Wish ${friendName} a happy ${holiday.holiday.name}`;
  }

  if (holiday.isTomorrow) {
    return `${holiday.holiday.name} is tomorrow—connect with ${friendName}`;
  }

  return `${holiday.holiday.name} connection with ${friendName}`;
}

/**
 * Get holiday-specific suggestion subtitle
 */
export function getHolidaySuggestionSubtitle(holiday: UpcomingHoliday): string {
  if (holiday.isToday) {
    return holiday.holiday.shortPrompt;
  }

  if (holiday.daysUntil <= 3) {
    return holiday.holiday.shortPrompt;
  }

  return holiday.holiday.connectionPrompt;
}
