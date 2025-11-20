/**
 * Pattern Detection Algorithm
 * Analyzes battery history and weaves to detect meaningful patterns
 */

import { database } from '../db';
import UserProfile, { BatteryHistoryEntry } from '../db/models/UserProfile';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import FriendModel from '../db/models/Friend';
import WeeklyReflection from '../db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { calculateInteractionQuality } from '@/modules/intelligence';
import { STORY_CHIPS, ChipType } from './story-chips';

export interface Pattern {
  id: string;
  type: 'cyclical' | 'correlation' | 'best_days' | 'consistency' | 'trend' | 'quality_depth' | 'adaptive_decay' | 'archetype_affinity' | 'momentum' | 'reflection' | 'emotional' | 'thematic';
  title: string;
  description: string;
  insight: string;
  confidence: 'high' | 'medium' | 'low'; // How confident we are in this pattern
  icon: string; // Emoji
  data?: unknown; // Optional supporting data (use type guards before accessing)
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
 * Detect quality depth patterns - analyzes interaction quality metrics
 */
async function detectQualityDepthPattern(weaves: Interaction[]): Promise<Pattern | null> {
  if (weaves.length < 10) return null;

  // Calculate quality metrics for all weaves
  const qualityData = await Promise.all(
    weaves.map(async (weave) => {
      const quality = calculateInteractionQuality({
        vibe: weave.vibe,
        duration: weave.duration,
        note: weave.note,
        reflectionJSON: weave.reflectionJSON,
      });

      // Get friend names
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', weave.id))
        .fetch();

      const friendNames = await Promise.all(
        interactionFriends.map(async (ifriend: InteractionFriend) => {
          try {
            const friendId = ifriend._raw.friend_id as string;
            const friend = await database.get<FriendModel>('friends').find(friendId);
            return friend.name;
          } catch {
            return null;
          }
        })
      );

      return {
        quality,
        friendNames: friendNames.filter((n): n is string => n !== null),
      };
    })
  );

  // Group by friend and calculate average quality
  const friendQualityMap = new Map<string, { totalQuality: number; count: number }>();

  qualityData.forEach(({ quality, friendNames }) => {
    friendNames.forEach((name) => {
      const existing = friendQualityMap.get(name) || { totalQuality: 0, count: 0 };
      friendQualityMap.set(name, {
        totalQuality: existing.totalQuality + quality.overallQuality,
        count: existing.count + 1,
      });
    });
  });

  // Find friends with highest quality scores (need at least 3 interactions)
  const qualityFriends = Array.from(friendQualityMap.entries())
    .filter(([_, data]) => data.count >= 3)
    .map(([name, data]) => ({ name, avgQuality: data.totalQuality / data.count, count: data.count }))
    .sort((a, b) => b.avgQuality - a.avgQuality);

  if (qualityFriends.length === 0) return null;

  const topFriend = qualityFriends[0];
  const avgAllQuality =
    qualityData.reduce((sum, d) => sum + d.quality.overallQuality, 0) / qualityData.length;

  // Only show pattern if there's a meaningful difference
  if (topFriend.avgQuality - avgAllQuality < 0.5) return null;

  const topFriendsList = qualityFriends.slice(0, 3).map((f) => f.name);

  return {
    id: 'quality-depth',
    type: 'quality_depth',
    title: 'Deep Connections',
    description: `Your deepest, most intentional interactions are with ${topFriendsList.join(', ')} (${topFriend.avgQuality.toFixed(1)}/5 quality vs ${avgAllQuality.toFixed(1)}/5 average).`,
    insight: `Consider bringing this level of intentionality to other friendships. Depth creates lasting bonds.`,
    confidence: topFriend.avgQuality >= 4 ? 'high' : topFriend.avgQuality >= 3.5 ? 'medium' : 'low',
    icon: '🧘',
    data: { topFriends: qualityFriends.slice(0, 5), avgAllQuality },
  };
}

/**
 * Detect adaptive decay patterns - shows learned tolerance windows
 */
async function detectAdaptiveDecayPattern(): Promise<Pattern | null> {
  const allFriends = await database.get<FriendModel>('friends').query().fetch();

  // Filter friends with learned tolerance windows (5+ rated interactions)
  const adaptedFriends = allFriends.filter(
    (f) => f.toleranceWindowDays && f.totalInteractionsLogged >= 5
  );

  if (adaptedFriends.length < 3) return null;

  // Find the most interesting adaptive pattern
  const defaultWindows: Record<string, number> = {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  };

  const adaptations = adaptedFriends.map((f) => {
    const defaultWindow = defaultWindows[f.dunbarTier] || 14;
    const learnedWindow = f.toleranceWindowDays || defaultWindow;
    const difference = learnedWindow - defaultWindow;
    return { name: f.name, tier: f.dunbarTier, learnedWindow, defaultWindow, difference };
  });

  // Sort by most significant adaptation (positive or negative)
  adaptations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  const mostAdapted = adaptations[0];

  // Only show if there's meaningful learning (at least 3 days difference)
  if (Math.abs(mostAdapted.difference) < 3) return null;

  const direction = mostAdapted.difference > 0 ? 'comfortable' : 'closer';
  const rhythm = mostAdapted.difference > 0 ? 'relaxed' : 'frequent';

  return {
    id: 'adaptive-decay',
    type: 'adaptive_decay',
    title: 'Natural Rhythms Learned',
    description: `You and ${mostAdapted.name} have settled into a ${rhythm} ${mostAdapted.learnedWindow}-day rhythm (vs typical ${mostAdapted.defaultWindow}-day for ${mostAdapted.tier}).`,
    insight: `The app has adapted to honor this natural flow. Your authentic connection patterns are being respected.`,
    confidence: adaptedFriends.length >= 5 ? 'high' : 'medium',
    icon: '🌊',
    data: { mostAdapted, allAdaptations: adaptations.slice(0, 5) },
  };
}

/**
 * Detect archetype affinity patterns - which archetypes you connect best with
 */
async function detectArchetypeAffinityPattern(weaves: Interaction[]): Promise<Pattern | null> {
  if (weaves.length < 15) return null;

  // Get all friends to map archetypes
  const allFriends = await database.get<FriendModel>('friends').query().fetch();
  const friendArchetypeMap = new Map<string, string>();
  allFriends.forEach((f) => friendArchetypeMap.set(f.id, f.archetype));

  // Build archetype -> scores mapping
  const archetypeData = new Map<
    string,
    { totalScore: number; count: number; friends: Set<string> }
  >();

  for (const weave of weaves) {
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query(Q.where('interaction_id', weave.id))
      .fetch();

    for (const ifriend of interactionFriends) {
      const friendId = ifriend._raw.friend_id as string;
      const archetype = friendArchetypeMap.get(friendId);
      if (!archetype) continue;

      try {
        const friend = await database.get<FriendModel>('friends').find(friendId);
        const existing = archetypeData.get(archetype) || {
          totalScore: 0,
          count: 0,
          friends: new Set(),
        };
        archetypeData.set(archetype, {
          totalScore: existing.totalScore + friend.weaveScore,
          count: existing.count + 1,
          friends: existing.friends.add(friend.name),
        });
      } catch {
        continue;
      }
    }
  }

  // Calculate average scores per archetype
  const archetypeScores = Array.from(archetypeData.entries())
    .filter(([_, data]) => data.count >= 3) // Need at least 3 interactions
    .map(([archetype, data]) => ({
      archetype,
      avgScore: data.totalScore / data.count,
      count: data.count,
      friendNames: Array.from(data.friends).slice(0, 3),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  if (archetypeScores.length < 2) return null;

  const best = archetypeScores[0];
  const worst = archetypeScores[archetypeScores.length - 1];
  const scoreDifference = best.avgScore - worst.avgScore;

  // Only show if there's a meaningful difference
  if (scoreDifference < 15) return null;

  return {
    id: 'archetype-affinity',
    type: 'archetype_affinity',
    title: 'Archetype Affinity',
    description: `You thrive with ${best.archetype} friends (avg ${Math.round(best.avgScore)} health), but ${worst.archetype} connections need more attention (avg ${Math.round(worst.avgScore)}).`,
    insight: `Your ${best.archetype} relationships come naturally. Consider being more intentional with ${worst.archetype} friends to maintain balance.`,
    confidence: scoreDifference >= 25 ? 'high' : 'medium',
    icon: '🎭',
    data: { best, worst, allArchetypes: archetypeScores },
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

  // Run all detection algorithms (existing patterns)
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

  // Run new pattern detection algorithms
  const qualityDepthPattern = await detectQualityDepthPattern(weaves);
  if (qualityDepthPattern) patterns.push(qualityDepthPattern);

  const adaptiveDecayPattern = await detectAdaptiveDecayPattern();
  if (adaptiveDecayPattern) patterns.push(adaptiveDecayPattern);

  const archetypeAffinityPattern = await detectArchetypeAffinityPattern(weaves);
  if (archetypeAffinityPattern) patterns.push(archetypeAffinityPattern);

  // Sort by confidence
  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  patterns.sort((a, b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence]);

  return patterns;
}
