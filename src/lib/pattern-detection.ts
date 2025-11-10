/**
 * Pattern Detection Algorithm
 * Analyzes battery history and weaves to detect meaningful patterns
 */

import { database } from '../db';
import UserProfile, { BatteryHistoryEntry } from '../db/models/UserProfile';
import Interaction from '../db/models/Interaction';
import WeeklyReflection from '../db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { STORY_CHIPS, ChipType } from './story-chips';

export interface Pattern {
  id: string;
  type: 'cyclical' | 'correlation' | 'best_days' | 'consistency' | 'trend' | 'emotional' | 'thematic';
  title: string;
  description: string;
  insight: string;
  confidence: 'high' | 'medium' | 'low'; // How confident we are in this pattern
  icon: string; // Emoji
  data?: any; // Optional supporting data
}

interface DayOfWeekData {
  day: number; // 0-6 (Sunday-Saturday)
  avgBattery: number;
  count: number;
}

interface WeaveDay {
  date: string; // YYYY-MM-DD
  weaveCount: number;
  batteryLevel: number | null;
}

/**
 * Fetch battery history from UserProfile
 */
async function fetchBatteryHistory(): Promise<BatteryHistoryEntry[]> {
  try {
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();
    if (profiles.length === 0) return [];
    return profiles[0].socialBatteryHistory || [];
  } catch (error) {
    console.error('Error fetching battery history:', error);
    return [];
  }
}

/**
 * Fetch weaves for pattern analysis
 */
async function fetchWeaves(daysBack: number = 90): Promise<Interaction[]> {
  try {
    const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    return await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', 'completed'),
        Q.where('interaction_date', Q.gte(cutoff))
      )
      .fetch();
  } catch (error) {
    console.error('Error fetching weaves:', error);
    return [];
  }
}

/**
 * Detect day-of-week cyclical patterns
 */
function detectDayOfWeekPatterns(history: BatteryHistoryEntry[]): Pattern | null {
  if (history.length < 21) return null; // Need at least 3 weeks of data

  // Group by day of week
  const dayData: DayOfWeekData[] = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    avgBattery: 0,
    count: 0,
  }));

  history.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const dayOfWeek = date.getDay();
    dayData[dayOfWeek].avgBattery += entry.value;
    dayData[dayOfWeek].count += 1;
  });

  // Calculate averages
  dayData.forEach((day) => {
    if (day.count > 0) {
      day.avgBattery = day.avgBattery / day.count;
    }
  });

  // Find highest and lowest energy days
  const validDays = dayData.filter((d) => d.count >= 3); // Need at least 3 data points
  if (validDays.length < 4) return null;

  const highestDay = validDays.reduce((max, day) => (day.avgBattery > max.avgBattery ? day : max));
  const lowestDay = validDays.reduce((min, day) => (day.avgBattery < min.avgBattery ? day : min));

  const difference = highestDay.avgBattery - lowestDay.avgBattery;

  // Only report if difference is significant (>= 0.8)
  if (difference < 0.8) return null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    id: 'day-of-week-cycle',
    type: 'cyclical',
    title: 'Weekly Energy Rhythm',
    description: `Your energy peaks on ${dayNames[highestDay.day]}s (${highestDay.avgBattery.toFixed(1)}/5) and dips on ${dayNames[lowestDay.day]}s (${lowestDay.avgBattery.toFixed(1)}/5).`,
    insight: `Plan important connections on ${dayNames[highestDay.day]}s when your battery is naturally higher.`,
    confidence: difference >= 1.5 ? 'high' : difference >= 1.0 ? 'medium' : 'low',
    icon: '📅',
    data: { dayData, highestDay, lowestDay },
  };
}

/**
 * Detect battery-weave correlation
 */
async function detectBatteryWeaveCorrelation(
  history: BatteryHistoryEntry[],
  weaves: Interaction[]
): Promise<Pattern | null> {
  if (history.length < 14 || weaves.length < 5) return null;

  // Create map of date -> weave count
  const weavesByDate = new Map<string, number>();
  weaves.forEach((weave) => {
    const date = new Date(weave.interactionDate);
    const dateKey = date.toISOString().split('T')[0];
    weavesByDate.set(dateKey, (weavesByDate.get(dateKey) || 0) + 1);
  });

  // Create paired data: days with both battery and weave data
  const pairedData: WeaveDay[] = [];
  history.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const dateKey = date.toISOString().split('T')[0];
    const weaveCount = weavesByDate.get(dateKey) || 0;

    pairedData.push({
      date: dateKey,
      weaveCount,
      batteryLevel: entry.value,
    });
  });

  if (pairedData.length < 10) return null;

  // Calculate correlation: high battery days vs weave count
  const highBatteryDays = pairedData.filter((d) => d.batteryLevel && d.batteryLevel >= 4);
  const lowBatteryDays = pairedData.filter((d) => d.batteryLevel && d.batteryLevel <= 2);

  if (highBatteryDays.length < 3 || lowBatteryDays.length < 3) return null;

  const avgWeavesHighBattery =
    highBatteryDays.reduce((sum, d) => sum + d.weaveCount, 0) / highBatteryDays.length;
  const avgWeavesLowBattery =
    lowBatteryDays.reduce((sum, d) => sum + d.weaveCount, 0) / lowBatteryDays.length;

  const difference = avgWeavesHighBattery - avgWeavesLowBattery;

  // Positive correlation: more weaves when battery is high
  if (difference >= 0.5) {
    return {
      id: 'battery-weave-positive',
      type: 'correlation',
      title: 'Energy Fuels Connection',
      description: `You weave ${avgWeavesHighBattery.toFixed(1)}x more on high-battery days (${avgWeavesHighBattery.toFixed(1)} weaves) vs low-battery days (${avgWeavesLowBattery.toFixed(1)} weaves).`,
      insight: 'Your social energy directly supports connection. Prioritize recharge when depleted.',
      confidence: difference >= 1.5 ? 'high' : difference >= 1.0 ? 'medium' : 'low',
      icon: '⚡',
      data: { avgWeavesHighBattery, avgWeavesLowBattery },
    };
  }

  // Inverse correlation: more weaves when battery is low (counterintuitive!)
  if (difference <= -0.5) {
    return {
      id: 'battery-weave-inverse',
      type: 'correlation',
      title: 'Connection Energizes You',
      description: `Interestingly, you weave more on low-battery days (${avgWeavesLowBattery.toFixed(1)} weaves) than high-battery days (${avgWeavesHighBattery.toFixed(1)} weaves).`,
      insight: 'Connection might be recharging you. Your friendships could be your battery source.',
      confidence: Math.abs(difference) >= 1.5 ? 'high' : Math.abs(difference) >= 1.0 ? 'medium' : 'low',
      icon: '💫',
      data: { avgWeavesHighBattery, avgWeavesLowBattery },
    };
  }

  return null;
}

/**
 * Detect best days for connection (high battery + high weaves)
 */
async function detectBestConnectionDays(
  history: BatteryHistoryEntry[],
  weaves: Interaction[]
): Promise<Pattern | null> {
  if (history.length < 21) return null;

  // Analyze by day of week
  const dayScores = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    totalBattery: 0,
    totalWeaves: 0,
    count: 0,
  }));

  // Sum up battery by day of week
  history.forEach((entry) => {
    const date = new Date(entry.timestamp);
    const dayOfWeek = date.getDay();
    dayScores[dayOfWeek].totalBattery += entry.value;
    dayScores[dayOfWeek].count += 1;
  });

  // Sum up weaves by day of week
  weaves.forEach((weave) => {
    const date = new Date(weave.interactionDate);
    const dayOfWeek = date.getDay();
    dayScores[dayOfWeek].totalWeaves += 1;
  });

  // Calculate composite score: (avgBattery * 0.5) + (avgWeaves * 0.5)
  const scored = dayScores
    .filter((d) => d.count >= 3)
    .map((d) => ({
      day: d.day,
      avgBattery: d.totalBattery / d.count,
      avgWeaves: d.totalWeaves / d.count,
      compositeScore: (d.totalBattery / d.count) * 0.5 + (d.totalWeaves / d.count) * 0.5,
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  if (scored.length < 4) return null;

  const bestDay = scored[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    id: 'best-connection-days',
    type: 'best_days',
    title: 'Your Sweet Spot',
    description: `${dayNames[bestDay.day]}s are your best connection days—high energy (${bestDay.avgBattery.toFixed(1)}/5) and active weaving (${bestDay.avgWeaves.toFixed(1)} weaves).`,
    insight: `Schedule meaningful catch-ups on ${dayNames[bestDay.day]}s when you're naturally in sync.`,
    confidence: bestDay.compositeScore >= 3 ? 'high' : bestDay.compositeScore >= 2 ? 'medium' : 'low',
    icon: '⭐',
    data: { bestDay, allDays: scored },
  };
}

/**
 * Detect consistency patterns
 */
function detectConsistencyPattern(history: BatteryHistoryEntry[]): Pattern | null {
  if (history.length < 30) return null;

  // Calculate variance in battery levels
  const avg = history.reduce((sum, e) => sum + e.value, 0) / history.length;
  const variance =
    history.reduce((sum, e) => sum + Math.pow(e.value - avg, 2), 0) / history.length;
  const stdDev = Math.sqrt(variance);

  // Low variance = consistent, high variance = volatile
  if (stdDev <= 0.8) {
    return {
      id: 'high-consistency',
      type: 'consistency',
      title: 'Steady Energy Flow',
      description: `Your battery stays remarkably consistent around ${avg.toFixed(1)}/5 (variance: ${stdDev.toFixed(2)}).`,
      insight: 'Your steady rhythm suggests strong self-awareness and energy management.',
      confidence: 'high',
      icon: '🧘',
      data: { avg, stdDev },
    };
  }

  if (stdDev >= 1.5) {
    return {
      id: 'high-volatility',
      type: 'consistency',
      title: 'Dynamic Energy Shifts',
      description: `Your battery fluctuates significantly (variance: ${stdDev.toFixed(2)}), ranging across ${Math.max(...history.map((h) => h.value)) - Math.min(...history.map((h) => h.value))} levels.`,
      insight: 'Your energy is responsive to external factors. Consider tracking what influences your shifts.',
      confidence: 'high',
      icon: '🌊',
      data: { avg, stdDev },
    };
  }

  return null;
}

/**
 * Detect battery trend (improving, declining, stable)
 */
function detectTrendPattern(history: BatteryHistoryEntry[]): Pattern | null {
  if (history.length < 14) return null;

  // Split into first half and second half
  const midpoint = Math.floor(history.length / 2);
  const firstHalf = history.slice(0, midpoint);
  const secondHalf = history.slice(midpoint);

  const avgFirst = firstHalf.reduce((sum, e) => sum + e.value, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, e) => sum + e.value, 0) / secondHalf.length;

  const change = avgSecond - avgFirst;

  // Rising trend
  if (change >= 0.6) {
    return {
      id: 'rising-trend',
      type: 'trend',
      title: 'Energy on the Rise',
      description: `Your battery has increased from ${avgFirst.toFixed(1)}/5 to ${avgSecond.toFixed(1)}/5 recently (+${change.toFixed(1)}).`,
      insight: 'Something is working! Reflect on what has been different lately.',
      confidence: change >= 1.0 ? 'high' : 'medium',
      icon: '📈',
      data: { avgFirst, avgSecond, change },
    };
  }

  // Declining trend
  if (change <= -0.6) {
    return {
      id: 'declining-trend',
      type: 'trend',
      title: 'Energy Drifting Lower',
      description: `Your battery has decreased from ${avgFirst.toFixed(1)}/5 to ${avgSecond.toFixed(1)}/5 recently (${change.toFixed(1)}).`,
      insight: 'This might be a signal to prioritize rest and recalibrate your pace.',
      confidence: Math.abs(change) >= 1.0 ? 'high' : 'medium',
      icon: '📉',
      data: { avgFirst, avgSecond, change },
    };
  }

  // Stable
  return {
    id: 'stable-trend',
    type: 'trend',
    title: 'Steady State',
    description: `Your battery has remained stable around ${avgSecond.toFixed(1)}/5.`,
    insight: 'Your current rhythm is sustainable. Keep doing what works.',
    confidence: 'medium',
    icon: '➡️',
    data: { avgFirst, avgSecond, change },
  };
}

/**
 * Detect emotional patterns from story chip data
 */
async function detectEmotionalPatterns(weaves: Interaction[]): Promise<Pattern | null> {
  // Collect all feeling chips from weaves
  const feelingCounts: Record<string, number> = {};

  weaves.forEach(weave => {
    if (weave.reflection?.chips) {
      weave.reflection.chips.forEach((chip: { chipId: string }) => {
        const chipData = STORY_CHIPS.find(c => c.id === chip.chipId && c.type === 'feeling');
        if (chipData) {
          feelingCounts[chip.chipId] = (feelingCounts[chip.chipId] || 0) + 1;
        }
      });
    }
  });

  const totalFeelings = Object.values(feelingCounts).reduce((sum, count) => sum + count, 0);
  if (totalFeelings < 5) return null; // Need at least 5 feeling reflections

  // Find dominant feeling
  const sortedFeelings = Object.entries(feelingCounts)
    .sort((a, b) => b[1] - a[1]);

  if (sortedFeelings.length === 0) return null;

  const [dominantChipId, count] = sortedFeelings[0];
  const chipData = STORY_CHIPS.find(c => c.id === dominantChipId);
  if (!chipData) return null;

  const percentage = (count / totalFeelings) * 100;

  // Only report if this feeling is significantly dominant (>30%)
  if (percentage < 30) return null;

  return {
    id: 'dominant-feeling',
    type: 'emotional',
    title: 'Your Emotional Signature',
    description: `You often feel "${chipData.plainText}" in your connections (${count}× this quarter, ${percentage.toFixed(0)}% of reflections).`,
    insight: 'This recurring feeling reveals something important about what you value in relationships.',
    confidence: percentage > 50 ? 'high' : 'medium',
    icon: '💫',
    data: { chipId: dominantChipId, count, percentage, label: chipData.plainText },
  };
}

/**
 * Detect thematic patterns from story chip data
 */
async function detectThematicPatterns(weaves: Interaction[]): Promise<Pattern | null> {
  // Collect all topic chips from weaves
  const topicCounts: Record<string, number> = {};

  weaves.forEach(weave => {
    if (weave.reflection?.chips) {
      weave.reflection.chips.forEach((chip: { chipId: string }) => {
        const chipData = STORY_CHIPS.find(c => c.id === chip.chipId && c.type === 'topic');
        if (chipData) {
          topicCounts[chip.chipId] = (topicCounts[chip.chipId] || 0) + 1;
        }
      });
    }
  });

  const totalTopics = Object.values(topicCounts).reduce((sum, count) => sum + count, 0);
  if (totalTopics < 5) return null; // Need at least 5 topic reflections

  // Find dominant topic
  const sortedTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1]);

  if (sortedTopics.length === 0) return null;

  const [dominantChipId, count] = sortedTopics[0];
  const chipData = STORY_CHIPS.find(c => c.id === dominantChipId);
  if (!chipData) return null;

  const percentage = (count / totalTopics) * 100;

  // Only report if this topic is significantly recurring (>25%)
  if (percentage < 25) return null;

  return {
    id: 'recurring-theme',
    type: 'thematic',
    title: 'Conversation Pattern',
    description: `A recurring theme in your connections: "${chipData.plainText}" (${count}× this quarter).`,
    insight: 'The topics you return to reveal what matters most to you right now.',
    confidence: percentage > 40 ? 'high' : 'medium',
    icon: '💬',
    data: { chipId: dominantChipId, count, percentage, label: chipData.plainText },
  };
}

/**
 * Main function: detect all patterns
 */
export async function detectPatterns(): Promise<Pattern[]> {
  const history = await fetchBatteryHistory();
  const weaves = await fetchWeaves(90); // Last 90 days

  if (history.length < 7) {
    return []; // Not enough data
  }

  const patterns: Pattern[] = [];

  // Run all detection algorithms
  const cyclicalPattern = detectDayOfWeekPatterns(history);
  if (cyclicalPattern) patterns.push(cyclicalPattern);

  const correlationPattern = await detectBatteryWeaveCorrelation(history, weaves);
  if (correlationPattern) patterns.push(correlationPattern);

  const bestDaysPattern = await detectBestConnectionDays(history, weaves);
  if (bestDaysPattern) patterns.push(bestDaysPattern);

  const consistencyPattern = detectConsistencyPattern(history);
  if (consistencyPattern) patterns.push(consistencyPattern);

  const trendPattern = detectTrendPattern(history);
  if (trendPattern) patterns.push(trendPattern);

  // Qualitative/emotional patterns from story chips
  const emotionalPattern = await detectEmotionalPatterns(weaves);
  if (emotionalPattern) patterns.push(emotionalPattern);

  const thematicPattern = await detectThematicPatterns(weaves);
  if (thematicPattern) patterns.push(thematicPattern);

  // Sort by confidence
  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  patterns.sort((a, b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence]);

  return patterns;
}
