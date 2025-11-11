/**
 * Text Analysis for Contextual Chip Suggestions
 * Analyzes user's custom text to detect themes and suggest relevant chips
 */

export interface TextThemes {
  emotions: string[];
  activities: string[];
  topics: string[];
  intensity: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

/**
 * Keyword mappings for theme detection
 */
const EMOTION_KEYWORDS = {
  positive: ['happy', 'joyful', 'excited', 'grateful', 'loved', 'connected', 'understood', 'safe', 'comfortable', 'inspired', 'energized', 'alive', 'radiant', 'blessed', 'lucky', 'warm', 'cherished', 'nourished'],
  negative: ['sad', 'upset', 'hurt', 'angry', 'frustrated', 'distant', 'disconnected', 'misunderstood', 'awkward', 'difficult', 'hard', 'exhausting', 'draining', 'lonely', 'anxious'],
  mixed: ['bittersweet', 'complicated', 'conflicted', 'exhausted but good', 'hard but worth it', 'vulnerable'],
  laughter: ['laugh', 'laughed', 'laughing', 'funny', 'hilarious', 'cracked up', 'lol', 'haha'],
  deep: ['deep', 'profound', 'meaningful', 'vulnerable', 'opened up', 'shared', 'breakthrough', 'realized', 'understood'],
  comfort: ['comfortable', 'cozy', 'relaxed', 'easy', 'natural', 'effortless', 'peaceful', 'calm'],
  energy: ['energized', 'alive', 'hyped', 'excited', 'pumped', 'vibrant', 'dynamic'],
};

const ACTIVITY_KEYWORDS = {
  meal: ['ate', 'dinner', 'lunch', 'breakfast', 'coffee', 'meal', 'food', 'cooked', 'cooking', 'restaurant', 'café', 'brunch'],
  talk: ['talked', 'chatted', 'discussed', 'conversation', 'spoke', 'shared', 'told', 'caught up'],
  deep_talk: ['deep conversation', 'opened up', 'vulnerable', 'shared feelings', 'talked about', 'discussed our'],
  activity: ['did', 'went', 'played', 'watched', 'worked on', 'created', 'made', 'practiced'],
  walk: ['walked', 'strolled', 'wandered', 'hiked', 'exploring'],
  call: ['called', 'video call', 'phone', 'facetime', 'zoom', 'texted', 'messaged'],
  party: ['party', 'event', 'celebration', 'gathering', 'get-together'],
  helped: ['helped', 'supported', 'was there for', 'assisted'],
};

const TOPIC_KEYWORDS = {
  work: ['work', 'job', 'career', 'project', 'boss', 'colleague'],
  relationships: ['relationship', 'dating', 'love', 'partner', 'family', 'parents', 'kids'],
  future: ['future', 'plans', 'goals', 'dreams', 'hope', 'want to', 'going to'],
  past: ['remember', 'recalled', 'memory', 'memories', 'reminisced', 'used to', 'back when'],
  struggles: ['struggling', 'difficult', 'hard time', 'challenge', 'tough', 'worried', 'stressed'],
  ideas: ['idea', 'brainstormed', 'thinking about', 'what if', 'imagine', 'creative'],
  personal: ['feeling', 'think', 'believe', 'identity', 'who I am', 'myself'],
};

/**
 * Analyze user's text to extract themes and keywords
 */
export function analyzeText(text: string): TextThemes {
  if (!text || text.trim().length === 0) {
    return {
      emotions: [],
      activities: [],
      topics: [],
      intensity: 'low',
      sentiment: 'neutral',
    };
  }

  const lowerText = text.toLowerCase();
  const emotions: string[] = [];
  const activities: string[] = [];
  const topics: string[] = [];

  // Detect emotions
  let positiveCount = 0;
  let negativeCount = 0;

  Object.entries(EMOTION_KEYWORDS).forEach(([emotion, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      emotions.push(emotion);
      if (emotion === 'positive') positiveCount++;
      if (emotion === 'negative') negativeCount++;
    }
  });

  // Detect activities
  Object.entries(ACTIVITY_KEYWORDS).forEach(([activity, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      activities.push(activity);
    }
  });

  // Detect topics
  Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      topics.push(topic);
    }
  });

  // Determine sentiment
  let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
  if (emotions.includes('mixed') || (positiveCount > 0 && negativeCount > 0)) {
    sentiment = 'mixed';
  } else if (positiveCount > negativeCount) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative';
  }

  // Determine intensity based on exclamation marks, caps, and word count
  const exclamationCount = (text.match(/!/g) || []).length;
  const capsWords = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  const wordCount = text.split(/\s+/).length;

  let intensity: 'low' | 'medium' | 'high' = 'low';
  if (exclamationCount >= 2 || capsWords >= 2 || wordCount > 50) {
    intensity = 'high';
  } else if (exclamationCount >= 1 || capsWords >= 1 || wordCount > 20) {
    intensity = 'medium';
  }

  return {
    emotions,
    activities,
    topics,
    intensity,
    sentiment,
  };
}

/**
 * Calculate relevance score for a chip based on detected themes
 */
export function calculateThemeRelevance(chipKeywords: string[], detectedThemes: TextThemes): number {
  let score = 0;

  // Check if chip keywords match detected themes
  chipKeywords.forEach(keyword => {
    if (detectedThemes.emotions.includes(keyword)) score += 10;
    if (detectedThemes.activities.includes(keyword)) score += 8;
    if (detectedThemes.topics.includes(keyword)) score += 6;
  });

  return score;
}

/**
 * Generate contextual prompt based on detected themes
 */
export function generateContextualPrompt(themes: TextThemes): string | null {
  // High intensity positive emotions
  if (themes.intensity === 'high' && themes.sentiment === 'positive') {
    return 'Sounds like a great time! 🌟';
  }

  // Laughter detected
  if (themes.emotions.includes('laughter')) {
    return 'Lots of laughs? 😄';
  }

  // Deep conversation
  if (themes.emotions.includes('deep') || themes.activities.includes('deep_talk')) {
    return 'Sounds meaningful 💭';
  }

  // Mixed/complex emotions
  if (themes.sentiment === 'mixed') {
    return 'Complex feelings? 🌙';
  }

  // Difficult/negative
  if (themes.sentiment === 'negative' || themes.topics.includes('struggles')) {
    return 'That sounds tough 💙';
  }

  // Comfort/ease
  if (themes.emotions.includes('comfort')) {
    return 'Nice and comfortable? ☕';
  }

  return null;
}
