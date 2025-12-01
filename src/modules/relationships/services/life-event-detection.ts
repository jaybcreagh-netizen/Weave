import { database } from '@/db';
import LifeEvent, { LifeEventType, LifeEventImportance } from '@/db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';

/**
 * Life Event NLP Detection System
 *
 * Analyzes journal/note text to detect major life events happening to friends.
 * Automatically creates LifeEvent records when patterns are matched.
 */

interface LifeEventPattern {
  type: LifeEventType;
  importance: LifeEventImportance;
  keywords: string[];
  phrases: string[];
  contextWords: string[]; // Words that strengthen detection confidence
}

/**
 * Comprehensive pattern library for life event detection
 * Patterns are case-insensitive and use word boundaries
 */
const LIFE_EVENT_PATTERNS: LifeEventPattern[] = [
  {
    type: 'new_job',
    importance: 'high',
    keywords: ['new job', 'got hired', 'started working', 'job offer', 'new position', 'new role', 'starting at'],
    phrases: [
      'accepted',
      'offer',
      'hired',
      'starting',
      'first day',
      'onboarding',
      'interview',
      'career change',
      'promotion',
      'new company'
    ],
    contextWords: ['work', 'company', 'office', 'team', 'manager', 'career', 'salary', 'role'],
  },
  {
    type: 'moving',
    importance: 'high',
    keywords: ['moving', 'moved', 'new place', 'new apartment', 'new house', 'relocating', 'new city'],
    phrases: [
      'packing',
      'unpacking',
      'boxes',
      'lease',
      'closing',
      'bought a house',
      'renting',
      'moving truck',
      'new address',
      'settling in'
    ],
    contextWords: ['apartment', 'house', 'home', 'neighborhood', 'city', 'address', 'landlord'],
  },
  {
    type: 'wedding',
    importance: 'critical',
    keywords: ['getting married', 'wedding', 'engaged', 'engagement', 'fiancé', 'fiancée'],
    phrases: [
      'proposal',
      'ring',
      'venue',
      'save the date',
      'wedding planning',
      'honeymoon',
      'bride',
      'groom',
      'spouse',
      'married life'
    ],
    contextWords: ['ceremony', 'reception', 'vows', 'guests', 'dress', 'tux', 'celebration'],
  },
  {
    type: 'baby',
    importance: 'critical',
    keywords: ['pregnant', 'expecting', 'having a baby', 'newborn', 'baby', 'gave birth', 'became a parent'],
    phrases: [
      'due date',
      'maternity',
      'paternity',
      'nursery',
      'ultrasound',
      'baby shower',
      'diapers',
      'sleepless',
      'parenting',
      'new parent'
    ],
    contextWords: ['child', 'son', 'daughter', 'infant', 'pediatrician', 'labor', 'delivery'],
  },
  {
    type: 'loss',
    importance: 'critical',
    keywords: ['passed away', 'died', 'funeral', 'grieving', 'loss', 'memorial', 'mourning'],
    phrases: [
      'sad news',
      'devastating',
      'gone',
      'lost',
      'grief',
      'condolences',
      'sympathy',
      'ceremony',
      'saying goodbye',
      'remembering'
    ],
    contextWords: ['family', 'relative', 'friend', 'loved one', 'pet', 'death', 'passing'],
  },
  {
    type: 'health_event',
    importance: 'high',
    keywords: ['surgery', 'hospital', 'diagnosed', 'treatment', 'recovering', 'injury', 'medical'],
    phrases: [
      'doctor',
      'appointment',
      'procedure',
      'operation',
      'diagnosis',
      'medication',
      'therapy',
      'recovery',
      'health scare',
      'emergency room'
    ],
    contextWords: ['health', 'medical', 'illness', 'condition', 'symptoms', 'healing'],
  },
  {
    type: 'graduation',
    importance: 'high',
    keywords: ['graduated', 'graduation', 'degree', 'finished school', 'diploma'],
    phrases: [
      'ceremony',
      'commencement',
      'finals',
      'thesis',
      'dissertation',
      'cap and gown',
      'alumni',
      'completed',
      'masters',
      'phd'
    ],
    contextWords: ['school', 'university', 'college', 'education', 'student', 'academic'],
  },
  {
    type: 'celebration',
    importance: 'medium',
    keywords: ['celebrating', 'milestone', 'achievement', 'award', 'won', 'accomplished'],
    phrases: [
      'proud',
      'success',
      'victory',
      'recognition',
      'honor',
      'prize',
      'accomplishment',
      'reached',
      'completed',
      'achieved'
    ],
    contextWords: ['goal', 'dream', 'project', 'work', 'effort', 'dedication'],
  },
];

/**
 * Detect life events from text using pattern matching
 * Returns array of detected event types with confidence scores
 */
export function detectLifeEvents(text: string): Array<{
  type: LifeEventType;
  importance: LifeEventImportance;
  confidence: number;
  matchedTerms: string[];
}> {
  if (!text || text.trim().length === 0) return [];

  const lowerText = text.toLowerCase();
  const detectedEvents: Array<{
    type: LifeEventType;
    importance: LifeEventImportance;
    confidence: number;
    matchedTerms: string[];
  }> = [];

  for (const pattern of LIFE_EVENT_PATTERNS) {
    let score = 0;
    const matchedTerms: string[] = [];

    // Check for strong keyword matches (high confidence)
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 3;
        matchedTerms.push(keyword);
      }
    }

    // Check for phrase matches (medium confidence)
    for (const phrase of pattern.phrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        score += 1;
        matchedTerms.push(phrase);
      }
    }

    // Check for context words (boost confidence if primary match exists)
    if (score > 0) {
      for (const contextWord of pattern.contextWords) {
        if (lowerText.includes(contextWord.toLowerCase())) {
          score += 0.5;
        }
      }
    }

    // If confidence threshold met, add to detected events
    // Threshold: 3+ points (at least one strong keyword match)
    if (score >= 3) {
      const confidence = Math.min(score / 10, 1.0); // Normalize to 0-1
      detectedEvents.push({
        type: pattern.type,
        importance: pattern.importance,
        confidence,
        matchedTerms: matchedTerms.slice(0, 3), // Keep top 3 matched terms
      });
    }
  }

  // Sort by confidence (highest first)
  detectedEvents.sort((a, b) => b.confidence - a.confidence);

  return detectedEvents;
}

/**
 * Automatically tag a friend with a detected life event
 * Creates LifeEvent record if not already present
 */
export async function tagFriendWithLifeEvent(
  friendId: string,
  eventType: LifeEventType,
  importance: LifeEventImportance,
  detectedFrom: string, // The source text where it was detected
  eventDate?: Date
): Promise<LifeEvent | null> {
  try {
    // Check if similar event already exists for this friend (within last 30 days)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const existingEvents = await database
      .get<LifeEvent>('life_events')
      .query(

        Q.where('friend_id', friendId),
        Q.where('event_type', eventType),
        Q.where('created_at', Q.gte(thirtyDaysAgo))
      )
      .fetch();

    if (existingEvents.length > 0) {
      // Event already tagged recently, don't duplicate
      return existingEvents[0];
    }

    // Create new life event
    const newEvent = await database.write(async () => {
      return await database.get<LifeEvent>('life_events').create(event => {
        event.friendId = friendId;
        event.eventType = eventType;
        event.eventDate = eventDate || new Date();
        event.title = generateEventTitle(eventType);
        event.notes = `Detected from: "${detectedFrom.substring(0, 100)}..."`;
        event.importance = importance;
        event.source = 'keyword_detected';
        event.isRecurring = false;
        event.reminded = false;
      });
    });

    return newEvent;
  } catch (error) {
    console.error('Error tagging life event:', error);
    return null;
  }
}

/**
 * Generate a user-friendly title for a life event type
 */
function generateEventTitle(eventType: LifeEventType): string {
  const titles: Record<LifeEventType, string> = {
    new_job: 'Starting New Job',
    moving: 'Moving/Relocating',
    wedding: 'Getting Married',
    baby: 'New Baby/Pregnancy',
    loss: 'Loss/Grief',
    health_event: 'Health Event',
    graduation: 'Graduation',
    celebration: 'Milestone/Achievement',
    birthday: 'Birthday',
    anniversary: 'Anniversary',
    other: 'Life Event',
  };
  return titles[eventType] || 'Life Event';
}

/**
 * Analyze interaction notes/reflections and auto-tag life events
 * Call this when interactions are created or updated with notes
 */
export async function analyzeAndTagLifeEvents(
  friendId: string,
  text: string,
  interactionDate?: Date
): Promise<LifeEvent[]> {
  const detected = detectLifeEvents(text);
  const createdEvents: LifeEvent[] = [];

  for (const detection of detected) {
    // Only auto-tag high confidence (>0.5) and medium+ importance events
    if (detection.confidence >= 0.5) {
      const event = await tagFriendWithLifeEvent(
        friendId,
        detection.type,
        detection.importance,
        text,
        interactionDate
      );
      if (event) {
        createdEvents.push(event);
      }
    }
  }

  return createdEvents;
}

/**
 * Get active life events for a friend (past 60 days or future)
 * These should influence suggestions and friend cards
 */
export async function getActiveFriendLifeEvents(friendId: string): Promise<LifeEvent[]> {
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

  return await database
    .get<LifeEvent>('life_events')
    .query(

      Q.where('friend_id', friendId),
      Q.or(
        Q.where('event_date', Q.gte(sixtyDaysAgo)),
        Q.where('event_date', Q.gt(Date.now()))
      )
    )
    .fetch();
}

/**
 * Get all friends with active life events
 * Useful for dashboard widgets and priority suggestions
 */
export async function getAllFriendsWithActiveLifeEvents(): Promise<
  Array<{ friendId: string; events: LifeEvent[] }>
> {
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;

  const allEvents = await database
    .get<LifeEvent>('life_events')
    .query(

      Q.or(
        Q.where('event_date', Q.gte(sixtyDaysAgo)),
        Q.where('event_date', Q.gt(Date.now()))
      ),
      Q.sortBy('event_date', 'desc')
    )
    .fetch();

  // Group by friend
  const friendEventMap = new Map<string, LifeEvent[]>();
  for (const event of allEvents) {
    const existing = friendEventMap.get(event.friendId) || [];
    existing.push(event);
    friendEventMap.set(event.friendId, existing);
  }

  return Array.from(friendEventMap.entries()).map(([friendId, events]) => ({
    friendId,
    events,
  }));
}
