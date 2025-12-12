/**
 * Pattern Detection Algorithm
 * Analyzes battery history and weaves to detect meaningful patterns
 */

import { database } from '@/db';
import UserProfile, { BatteryHistoryEntry } from '@/db/models/UserProfile';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { calculateInteractionQuality } from '@/modules/intelligence';
import { STORY_CHIPS, ChipType } from '@/modules/reflection';

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
 * Fetch battery history from social_battery_logs table
 */
async function fetchBatteryHistory(): Promise<BatteryHistoryEntry[]> {
  try {
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();
    if (profiles.length === 0) return [];

    const userId = profiles[0].id;
    const logs = await database
      .get<SocialBatteryLog>('social_battery_logs')
      .query(
        Q.where('user_id', userId),
        Q.sortBy('timestamp', Q.asc)
      )
      .fetch();

    // Convert to BatteryHistoryEntry format
    return logs.map(log => ({
      value: log.value,
      timestamp: log.timestamp,
    }));
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
  if (history.length < 10) return null; // Lowered from 21 to 10 - need at least ~1.5 weeks of data

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
  const validDays = dayData.filter((d) => d.count >= 2); // Lowered from 3 to 2 data points per day
  if (validDays.length < 3) return null; // Lowered from 4 to 3 valid days

  const highestDay = validDays.reduce((max, day) => (day.avgBattery > max.avgBattery ? day : max));
  const lowestDay = validDays.reduce((min, day) => (day.avgBattery < min.avgBattery ? day : min));

  const difference = highestDay.avgBattery - lowestDay.avgBattery;

  // Only report if difference is significant (>= 0.6, lowered from 0.8)
  if (difference < 0.6) return null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    id: 'day-of-week-cycle',
    type: 'cyclical',
    title: 'Weekly Energy Rhythm',
    description: `Your energy peaks on ${dayNames[highestDay.day]}s (${highestDay.avgBattery.toFixed(1)}/5) and dips on ${dayNames[lowestDay.day]}s (${lowestDay.avgBattery.toFixed(1)}/5).`,
    insight: `Plan important connections on ${dayNames[highestDay.day]}s when your battery is naturally higher.`,
    confidence: difference >= 1.5 ? 'high' : difference >= 1.0 ? 'medium' : 'low',
    icon: 'calendar',
    data: { dayData, highestDay, lowestDay },
  };
}

/**
 * Calculate Pearson correlation coefficient
 * Returns value between -1 and 1
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  if (denomX === 0 || denomY === 0) return 0;

  return numerator / (Math.sqrt(denomX) * Math.sqrt(denomY));
}

/**
 * Calculate time-weighted average
 * Recent values have higher weight based on exponential decay
 */
function calculateTimeWeightedAverage(
  values: { value: number; timestamp: number }[],
  decayDays: number = 30
): number {
  if (values.length === 0) return 0;

  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;
  const msPerDay = 1000 * 60 * 60 * 24;

  values.forEach(({ value, timestamp }) => {
    const daysSince = Math.max(0, (now - timestamp) / msPerDay);
    const weight = Math.exp(-daysSince / decayDays); // Exponential decay
    weightedSum += value * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Detect battery-weave correlation using Pearson coefficient
 */
async function detectBatteryWeaveCorrelation(
  history: BatteryHistoryEntry[],
  weaves: Interaction[]
): Promise<Pattern | null> {
  if (history.length < 8 || weaves.length < 3) return null;

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

  if (pairedData.length < 6) return null;

  // Calculate Pearson correlation
  const batteryLevels = pairedData.map((d) => d.batteryLevel || 0);
  const weaveCounts = pairedData.map((d) => d.weaveCount);

  const correlation = calculatePearsonCorrelation(batteryLevels, weaveCounts);

  // Strong positive correlation (> 0.5)
  if (correlation > 0.5) {
    // Calculate averages for description context
    const highBatteryDays = pairedData.filter((d) => d.batteryLevel && d.batteryLevel >= 4);
    const lowBatteryDays = pairedData.filter((d) => d.batteryLevel && d.batteryLevel <= 2);

    const avgWeavesHigh = highBatteryDays.length > 0
      ? highBatteryDays.reduce((sum, d) => sum + d.weaveCount, 0) / highBatteryDays.length
      : 0;
    const avgWeavesLow = lowBatteryDays.length > 0
      ? lowBatteryDays.reduce((sum, d) => sum + d.weaveCount, 0) / lowBatteryDays.length
      : 0;

    return {
      id: 'battery-weave-positive',
      type: 'correlation',
      title: 'Energy Fuels Connection',
      description: `Strong correlation (${correlation.toFixed(2)}) between your energy and social activity. You weave significantly more when your battery is full.`,
      insight: 'Your social energy directly supports connection. Prioritize recharge when depleted.',
      confidence: correlation > 0.7 ? 'high' : 'medium',
      icon: 'zap',
      data: { correlation, avgWeavesHigh, avgWeavesLow },
    };
  }

  // Strong negative correlation (< -0.5)
  if (correlation < -0.5) {
    // Calculate averages for description context
    const highBatteryDays = pairedData.filter((d) => d.batteryLevel && d.batteryLevel >= 4);
    const lowBatteryDays = pairedData.filter((d) => d.batteryLevel && d.batteryLevel <= 2);

    const avgWeavesHigh = highBatteryDays.length > 0
      ? highBatteryDays.reduce((sum, d) => sum + d.weaveCount, 0) / highBatteryDays.length
      : 0;
    const avgWeavesLow = lowBatteryDays.length > 0
      ? lowBatteryDays.reduce((sum, d) => sum + d.weaveCount, 0) / lowBatteryDays.length
      : 0;

    return {
      id: 'battery-weave-inverse',
      type: 'correlation',
      title: 'Connection Energizes You',
      description: `Inverse correlation (${correlation.toFixed(2)}) detected. You tend to weave more when your reported battery is lower.`,
      insight: 'Connection might be recharging you. Your friendships could be your battery source.',
      confidence: Math.abs(correlation) > 0.7 ? 'high' : 'medium',
      icon: 'sparkles',
      data: { correlation, avgWeavesHigh, avgWeavesLow },
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
  if (history.length < 12) return null; // Lowered from 21 to 12

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
    .filter((d) => d.count >= 2) // Lowered from 3 to 2
    .map((d) => ({
      day: d.day,
      avgBattery: d.totalBattery / d.count,
      avgWeaves: d.totalWeaves / d.count,
      compositeScore: (d.totalBattery / d.count) * 0.5 + (d.totalWeaves / d.count) * 0.5,
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  if (scored.length < 3) return null; // Lowered from 4 to 3

  const bestDay = scored[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    id: 'best-connection-days',
    type: 'best_days',
    title: 'Your Sweet Spot',
    description: `${dayNames[bestDay.day]}s are your best connection days—high energy (${bestDay.avgBattery.toFixed(1)}/5) and active weaving (${bestDay.avgWeaves.toFixed(1)} weaves).`,
    insight: `Schedule meaningful catch-ups on ${dayNames[bestDay.day]}s when you're naturally in sync.`,
    confidence: bestDay.compositeScore >= 3 ? 'high' : bestDay.compositeScore >= 2 ? 'medium' : 'low',
    icon: 'star',
    data: { bestDay, allDays: scored },
  };
}

/**
 * Detect consistency patterns
 */
function detectConsistencyPattern(history: BatteryHistoryEntry[]): Pattern | null {
  if (history.length < 14) return null; // Lowered from 30 to 14 (2 weeks)

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
      icon: 'scale',
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
      icon: 'activity',
      data: { avg, stdDev },
    };
  }

  return null;
}

/**
 * Detect battery trend (improving, declining, stable)
 */
function detectTrendPattern(history: BatteryHistoryEntry[]): Pattern | null {
  if (history.length < 8) return null; // Lowered from 14 to 8

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
      icon: 'trending-up',
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
      icon: 'trending-down',
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
    icon: 'arrow-right',
    data: { avgFirst, avgSecond, change },
  };
}

/**
 * Detect quality depth patterns - analyzes interaction quality metrics
 */
async function detectQualityDepthPattern(weaves: Interaction[]): Promise<Pattern | null> {
  if (weaves.length < 6) return null; // Lowered from 10 to 6

  // Calculate quality metrics for all weaves
  const qualityData = await Promise.all(
    weaves.map(async (weave) => {
      const quality = calculateInteractionQuality({
        vibe: weave.vibe as any,
        duration: weave.duration as any,
        note: weave.note || null,
        reflectionJSON: weave.reflectionJSON || null,
      });

      // Get friend names
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', weave.id))
        .fetch();

      const friendNames = await Promise.all(
        interactionFriends.map(async (ifriend: InteractionFriend) => {
          try {
            const friendId = ifriend.friendId;
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

  // Find friends with highest quality scores (need at least 2 interactions) - lowered from 3
  const qualityFriends = Array.from(friendQualityMap.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([name, data]) => ({ name, avgQuality: data.totalQuality / data.count, count: data.count }))
    .sort((a, b) => b.avgQuality - a.avgQuality);

  if (qualityFriends.length === 0) return null;

  const topFriend = qualityFriends[0];
  const avgAllQuality =
    qualityData.reduce((sum, d) => sum + d.quality.overallQuality, 0) / qualityData.length;

  // Only show pattern if there's a meaningful difference (lowered from 0.5 to 0.3)
  if (topFriend.avgQuality - avgAllQuality < 0.3) return null;

  const topFriendsList = qualityFriends.slice(0, 3).map((f) => f.name);

  return {
    id: 'quality-depth',
    type: 'quality_depth',
    title: 'Deep Connections',
    description: `Your deepest, most intentional interactions are with ${topFriendsList.join(', ')} (${topFriend.avgQuality.toFixed(1)}/5 quality vs ${avgAllQuality.toFixed(1)}/5 average).`,
    insight: `Consider bringing this level of intentionality to other friendships. Depth creates lasting bonds.`,
    confidence: topFriend.avgQuality >= 4 ? 'high' : topFriend.avgQuality >= 3.5 ? 'medium' : 'low',
    icon: 'gem',
    data: { topFriends: qualityFriends.slice(0, 5), avgAllQuality },
  };
}

/**
 * Detect adaptive decay patterns - shows learned tolerance windows
 */
async function detectAdaptiveDecayPattern(): Promise<Pattern | null> {
  const allFriends = await database.get<FriendModel>('friends').query().fetch();

  // Filter friends with learned tolerance windows (3+ rated weaves) - lowered from 5
  // Note: Using ratedWeavesCount as proxy for interaction history
  const adaptedFriends = allFriends.filter(
    (f) => f.toleranceWindowDays && f.ratedWeavesCount >= 3
  );

  if (adaptedFriends.length < 2) return null; // Lowered from 3 to 2

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

  // Only show if there's meaningful learning (at least 2 days difference) - lowered from 3
  if (Math.abs(mostAdapted.difference) < 2) return null;

  const direction = mostAdapted.difference > 0 ? 'comfortable' : 'closer';
  const rhythm = mostAdapted.difference > 0 ? 'relaxed' : 'frequent';

  return {
    id: 'adaptive-decay',
    type: 'adaptive_decay',
    title: 'Natural Rhythms Learned',
    description: `You and ${mostAdapted.name} have settled into a ${rhythm} ${mostAdapted.learnedWindow}-day rhythm (vs typical ${mostAdapted.defaultWindow}-day for ${mostAdapted.tier}).`,
    insight: `The app has adapted to honor this natural flow. Your authentic connection patterns are being respected.`,
    confidence: adaptedFriends.length >= 5 ? 'high' : 'medium',
    icon: 'brain',
    data: { mostAdapted, allAdaptations: adaptations.slice(0, 5) },
  };
}

/**
 * Detect archetype affinity patterns - which archetypes you connect best with
 */
async function detectArchetypeAffinityPattern(weaves: Interaction[]): Promise<Pattern | null> {
  if (weaves.length < 10) return null; // Lowered from 15 to 10

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
      const friendId = ifriend.friendId;
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
    .filter(([_, data]) => data.count >= 2) // Lowered from 3 to 2 interactions
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

  // Only show if there's a meaningful difference (lowered from 15 to 10)
  if (scoreDifference < 10) return null;

  return {
    id: 'archetype-affinity',
    type: 'archetype_affinity',
    title: 'Archetype Affinity',
    description: `You thrive with ${best.archetype} friends (avg ${Math.round(best.avgScore)} health), but ${worst.archetype} connections need more attention (avg ${Math.round(worst.avgScore)}).`,
    insight: `Your ${best.archetype} relationships come naturally. Consider being more intentional with ${worst.archetype} friends to maintain balance.`,
    confidence: scoreDifference >= 20 ? 'high' : scoreDifference >= 10 ? 'medium' : 'low', // Adjusted thresholds
    icon: 'users',
    data: { best, worst, allArchetypes: archetypeScores },
  };
}

/**
 * Detect content patterns (correlations between Chips/topics and Battery)
 */
async function detectContentPatterns(
  history: BatteryHistoryEntry[],
  weaves: Interaction[]
): Promise<Pattern[]> {
  const patterns: Pattern[] = [];
  if (history.length < 8 || weaves.length < 5) return patterns;

  // Create date -> battery map
  const batteryByDate = new Map<string, number>();
  history.forEach(entry => {
    const dateKey = new Date(entry.timestamp).toISOString().split('T')[0];
    batteryByDate.set(dateKey, entry.value);
  });

  // Group weaves by Chip ID
  const chipStats = new Map<string, { totalBattery: number; count: number; name: string }>();

  weaves.forEach(weave => {
    if (!weave.reflection) return;
    const dateKey = new Date(weave.interactionDate).toISOString().split('T')[0];
    const battery = batteryByDate.get(dateKey);

    // Only analyze weaves that have associated battery data
    if (battery !== undefined && weave.reflection.chips) {
      weave.reflection.chips.forEach(chip => {
        const stats = chipStats.get(chip.id) || { totalBattery: 0, count: 0, name: chip.plainText };
        stats.totalBattery += battery;
        stats.count += 1;
        chipStats.set(chip.id, stats);
      });
    }
  });

  // Calculate average battery for each chip
  const avgAllBattery = history.reduce((sum, h) => sum + h.value, 0) / history.length;

  const meaningfulStats = Array.from(chipStats.values())
    .filter(stat => stat.count >= 3) // At least 3 occurrences
    .map(stat => ({
      name: stat.name,
      avgBattery: stat.totalBattery / stat.count,
      diff: (stat.totalBattery / stat.count) - avgAllBattery,
      count: stat.count
    }));

  // Find energizing topics (high battery)
  const energizing = meaningfulStats
    .filter(stat => stat.diff >= 0.5)
    .sort((a, b) => b.diff - a.diff)[0];

  if (energizing) {
    patterns.push({
      id: `content-energizing-${energizing.name.replace(/\s/g, '-')}`,
      type: 'thematic',
      title: 'Energizing Topics',
      description: `You report higher energy (${energizing.avgBattery.toFixed(1)}/5) when you "${energizing.name}".`,
      insight: 'This activity seems to refill your cup. Prioritize it when feeling drained.',
      confidence: energizing.count >= 5 ? 'high' : 'medium',
      icon: 'zap',
      data: { stat: energizing }
    });
  }

  // Find draining topics (low battery)
  const draining = meaningfulStats
    .filter(stat => stat.diff <= -0.5)
    .sort((a, b) => a.diff - b.diff)[0]; // Sort ascending (most negative first)

  if (draining) {
    patterns.push({
      id: `content-draining-${draining.name.replace(/\s/g, '-')}`,
      type: 'thematic',
      title: 'Draining Activities',
      description: `Your energy tends to be lower (${draining.avgBattery.toFixed(1)}/5) when you "${draining.name}".`,
      insight: 'Be mindful of your capacity before committing to this.',
      confidence: draining.count >= 5 ? 'high' : 'medium',
      icon: 'battery-charging',
      data: { stat: draining }
    });
  }

  return patterns;
}


/**
 * Main function: detect all patterns
 */
export async function detectPatterns(): Promise<Pattern[]> {
  const history = await fetchBatteryHistory();
  const weaves = await fetchWeaves(90); // Last 90 days

  if (history.length < 5) {
    return []; // Not enough data (lowered from 7 to 5)
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

  // Run content pattern detection
  const contentPatterns = await detectContentPatterns(history, weaves);
  patterns.push(...contentPatterns);

  // Sort by confidence
  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  patterns.sort((a, b) => confidenceOrder[b.confidence] - confidenceOrder[a.confidence]);

  return patterns;
}

/**
 * Get statistics about the data available for pattern detection
 */
export async function getPatternDataStats(): Promise<{ batteryDays: number; weaveCount: number }> {
  const history = await fetchBatteryHistory();
  const weaves = await fetchWeaves(90);
  return { batteryDays: history.length, weaveCount: weaves.length };
}

/**
 * Data about best connection days for smart scheduling
 */


/**
 * Get best connection days data for smart scheduling
 * Returns the analyzed day-of-week data for battery and weave patterns
 */
export async function getBestConnectionDaysData(): Promise<BestDaysData | null> {
  const history = await fetchBatteryHistory();
  const weaves = await fetchWeaves(90);

  if (history.length < 12) return null; // Need enough history

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

  // Calculate composite score and averages for each day
  const scored = dayScores
    .filter((d) => d.count >= 2)
    .map((d) => ({
      day: d.day,
      avgBattery: d.totalBattery / d.count,
      avgWeaves: d.totalWeaves / d.count,
      compositeScore: (d.totalBattery / d.count) * 0.5 + (d.totalWeaves / d.count) * 0.5,
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  if (scored.length < 3) return null;

  const bestDay = scored[0];

  return {
    bestDay: {
      day: bestDay.day,
      avgBattery: bestDay.avgBattery,
      avgWeaves: bestDay.avgWeaves,
    },
    allDays: scored.map(d => ({
      day: d.day,
      avgBattery: d.avgBattery,
      avgWeaves: d.avgWeaves,
    })),
  };
}

/**
 * Get current battery level from the most recent check-in
 * Returns undefined if no recent battery data
 */
export async function getCurrentBatteryLevel(): Promise<number | undefined> {
  const history = await fetchBatteryHistory();
  if (history.length === 0) return undefined;

  // Get the most recent entry
  const mostRecent = history[history.length - 1];

  // Only return if checked in within last 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (mostRecent.timestamp < oneDayAgo) return undefined;

  return mostRecent.value;
}
