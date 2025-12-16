import { Archetype, InteractionCategory } from '../types/common';

export const ARCHETYPE_PREFERRED_CATEGORIES: Record<Archetype, InteractionCategory> = {
  'HighPriestess': 'deep-talk',
  'Fool': 'activity-hobby',
  'Sun': 'event-party',
  'Hermit': 'deep-talk',
  'Magician': 'activity-hobby',
  'Empress': 'meal-drink',
  'Emperor': 'hangout',
  'Lovers': 'deep-talk',
  'Unknown': 'hangout',
};

export const ARCHETYPE_DRIFT_SUGGESTIONS: Record<Archetype, string> = {
  'HighPriestess': 'The High Priestess values deep, meaningful conversations. Invite them for a one-on-one coffee to reconnect.',
  'Fool': 'The Adventurer loves shared experiences. Suggest a hike or trying something new together.',
  'Sun': 'The Sun thrives in joyful moments. Plan a fun hangout or celebrate something together.',
  'Hermit': 'The Hermit appreciates quiet, intimate time. Reach out for a thoughtful conversation.',
  'Magician': 'The Magician values creativity and collaboration. Suggest working on a project or exploring ideas together.',
  'Empress': 'The Empress nurtures through presence. Share a meal or spend quality time together.',
  'Emperor': 'The Emperor values loyalty and consistency. Show up and spend solid time together.',
  'Lovers': 'The Lovers value connection and harmony. Spend quality time together.',
  'Unknown': 'Reach out and reconnect.',
};

export const ARCHETYPE_MOMENTUM_SUGGESTIONS: Record<Archetype, string> = {
  'HighPriestess': 'Deepen your conversations - they value insight and truth.',
  'Fool': "Plan an adventure - they'd love to explore something new with you.",
  'Sun': 'Celebrate this connection - create a joyful moment together.',
  'Hermit': 'Create space for depth - they appreciate meaningful solitude with you.',
  'Magician': 'Collaborate on something creative - they love co-creating magic.',
  'Empress': 'Nurture each other - share warmth and care.',
  'Emperor': 'Build something together - they value purposeful connection.',
  'Lovers': 'Deepen your bond - they value closeness.',
  'Unknown': 'Keep nurturing this connection.',
};

export const ARCHETYPE_CELEBRATION_SUGGESTIONS: Record<Archetype, string[]> = {
  Emperor: ['Plan a structured celebration dinner', 'Organize a milestone celebration', 'Send a thoughtful, high-quality gift'],
  Empress: ['Host a cozy dinner party at your place', 'Bake or cook something special for them', 'Plan a comfort-focused celebration'],
  HighPriestess: ['Schedule a deep one-on-one conversation', 'Send a heartfelt, personal message', 'Arrange intimate tea or coffee time'],
  Fool: ['Plan a spontaneous surprise adventure', 'Throw an unexpected party', 'Organize something fun and playful'],
  Sun: ['Throw a big, energetic celebration', 'Host a vibrant party with others', 'Organize a group gathering in their honor'],
  Hermit: ['Schedule meaningful one-on-one quality time', 'Plan a quiet, thoughtful celebration', 'Arrange a peaceful walk or private dinner'],
  Magician: ['Collaborate on a creative celebration project', 'Plan a unique, experiential celebration', 'Create something special together'],
  Lovers: ['Plan a romantic or deeply connected celebration', 'create a shared memory together', 'Do something that honors your bond'],
  Unknown: ['Reach out with a thoughtful message', 'Plan a way to celebrate together'],
};

export const ARCHETYPE_DRIFT_TITLES: Record<Archetype, (name: string) => string[]> = {
  'Sun': (name) => [
    `It's been a while since you and ${name} connected`,
    `Your usual rhythm with ${name} has gone quiet`
  ],
  'Lovers': (name) => [
    `You and ${name} haven't spoken in some time`,
    `This connection with ${name} has been still lately`
  ],
  'Empress': (name) => [
    `${name} might appreciate hearing from you`,
    `It's been a moment since you checked in with ${name}`
  ],
  'Emperor': (name) => [
    `Your rhythm with ${name} has slowed`,
    `This connection with ${name} could use some attention soon`
  ],
  'Fool': (name) => [
    `${name} might be up for something`,
    `It's been a while since you and ${name} caught up`
  ],
  'HighPriestess': (name) => [
    `${name} is in a quiet stretch. Reach out when it feels right`,
    `This connection with ${name} runs deep. Check in when you're ready`
  ],
  'Hermit': (name) => [
    `${name} has been quiet. A small word might still land well`,
    `This friendship with ${name} rests easily, but a check-in could be nice`
  ],
  'Magician': (name) => [
    `It's been a while since you created with ${name}`,
    `Your dynamic with ${name} is waiting`
  ],
  'Unknown': (name) => [
    `This connection with ${name} has been quiet lately`,
    `${name} might welcome hearing from you`
  ]
};

export const ARCHETYPE_THRIVING_TITLES: Record<Archetype, (name: string) => string[]> = {
  'Sun': (name) => [
    `You and ${name} are in a good rhythm`,
    `This connection with ${name} is humming along nicely`
  ],
  'Lovers': (name) => [
    `You and ${name} are close right now`,
    `This bond with ${name} is feeling strong`
  ],
  'Empress': (name) => [
    `You've been showing up for ${name}. It shows`,
    `This connection with ${name} is well-tended`
  ],
  'Emperor': (name) => [
    `You and ${name} have a solid rhythm going`,
    `This friendship with ${name} is in good shape`
  ],
  'Fool': (name) => [
    `You and ${name} have been having fun lately`,
    `This bond with ${name} is feeling easy and light`
  ],
  'HighPriestess': (name) => [
    `You and ${name} are in a good place. Even in the quiet`,
    `This connection with ${name} is deep and steady`
  ],
  'Hermit': (name) => [
    `You and ${name} are comfortable. No news is good news here`,
    `This friendship with ${name} is resting well`
  ],
  'Magician': (name) => [
    `You and ${name} are in flow`,
    `The creative spark with ${name} is alive`
  ],
  'Unknown': (name) => [
    `This connection with ${name} is healthy`,
    `You and ${name} are in a good place`
  ]
};

export const ARCHETYPE_WARMING_TITLES: Record<Archetype, (name: string) => string[]> = {
  'Sun': (name) => [
    `You and ${name} are finding your rhythm again`,
    `This connection with ${name} is picking up energy`
  ],
  'Lovers': (name) => [
    `You and ${name} are getting closer again`,
    `This bond with ${name} is warming back up`
  ],
  'Empress': (name) => [
    `Your attention is making a difference with ${name}`,
    `This connection with ${name} is starting to bloom again`
  ],
  'Emperor': (name) => [
    `You're rebuilding momentum with ${name}`,
    `This friendship with ${name} is getting back on track`
  ],
  'Fool': (name) => [
    `You and ${name} are reconnecting. Feels good, right?`,
    `The spark with ${name} is coming back`
  ],
  'HighPriestess': (name) => [
    `Something's stirring between you and ${name}`,
    `This quiet connection with ${name} is waking up`
  ],
  'Hermit': (name) => [
    `You and ${name} are surfacing again. Gently`,
    `This thread with ${name} is slowly warming`
  ],
  'Magician': (name) => [
    `The energy with ${name} is coming back`,
    `You're finding your flow with ${name} again`
  ],
  'Unknown': (name) => [
    `This connection with ${name} is warming up`,
    `You and ${name} are getting closer`
  ]
};

export const ARCHETYPE_DORMANT_TITLES: Record<Archetype, (name: string) => string[]> = {
  'Sun': (name) => [
    `You and ${name} have gone quiet for a while now`,
    `This connection with ${name} has cooled. but it doesn't have to stay that way`
  ],
  'Lovers': (name) => [
    `It's been a long time since you and ${name} connected`,
    `This bond with ${name} has been waiting`
  ],
  'Empress': (name) => [
    `${name} hasn't heard from you in a while`,
    `This one's been on pause. Whenever you're ready to reach ${name}`
  ],
  'Emperor': (name) => [
    `This connection with ${name} has lapsed. It might be time to rebuild`,
    `You and ${name} have lost your rhythm`
  ],
  'Fool': (name) => [
    `It's been ages! ${name} might be wondering where you went`,
    `This friendship with ${name} has gone quiet. But probably wouldn't take much to revive`
  ],
  'HighPriestess': (name) => [
    `This connection with ${name} has been resting for a while. Trust your timing`,
    `${name} is still there, in the quiet. No rush`
  ],
  'Hermit': (name) => [
    `You and ${name} have been in a long silence. And that might be okay`,
    `This friendship with ${name} is dormant. It'll keep`
  ],
  'Magician': (name) => [
    `The spark with ${name} has faded for now`,
    `It's been a long time since you created with ${name}`
  ],
  'Unknown': (name) => [
    `This connection with ${name} has been quiet for a while`,
    `${name} is still here when you're ready`
  ]
};

export const ARCHETYPE_NEW_TITLES: Record<Archetype, (name: string) => string[]> = {
  'Sun': (name) => [
    `${name}'s new here. Set the tone early`,
    `Fresh connection. Time to build some momentum with ${name}`
  ],
  'Lovers': (name) => [
    `You've added ${name}. What kind of bond is this becoming?`,
    `New thread with ${name}. Handle with care`
  ],
  'Empress': (name) => [
    `${name}'s new to your circle. How do you want to show up?`,
    `A new connection to nurture with ${name}`
  ],
  'Emperor': (name) => [
    `${name}'s been added. Time to establish a rhythm`,
    `New connection with ${name}. What structure feels right?`
  ],
  'Fool': (name) => [
    `${name}'s new! Where will this one go?`,
    `Fresh start with ${name}. See where it takes you`
  ],
  'HighPriestess': (name) => [
    `${name}'s new here. Let it unfold`,
    `A new thread with ${name}. Listen to it`
  ],
  'Hermit': (name) => [
    `${name}'s new. No pressure to rush this one`,
    `New connection with ${name}. Give it space to breathe`
  ],
  'Magician': (name) => [
    `${name} is new. What will you create together?`,
    `New possibility with ${name}. See where it leads`
  ],
  'Unknown': (name) => [
    `New connection added with ${name}`,
    `${name} is new here. Where will this go?`
  ]
};

export function getArchetypePreferredCategory(archetype: Archetype): InteractionCategory {
  return ARCHETYPE_PREFERRED_CATEGORIES[archetype] || 'hangout';
}

export function getArchetypeDriftSuggestion(archetype: Archetype): string {
  return ARCHETYPE_DRIFT_SUGGESTIONS[archetype] || 'Reach out and reconnect.';
}

export function getArchetypeMomentumSuggestion(archetype: Archetype): string {
  return ARCHETYPE_MOMENTUM_SUGGESTIONS[archetype] || 'Keep nurturing this connection.';
}

export function getArchetypeCelebrationSuggestion(archetype: Archetype): string {
  const suggestions = ARCHETYPE_CELEBRATION_SUGGESTIONS[archetype] || ARCHETYPE_CELEBRATION_SUGGESTIONS['Unknown'];
  const randomIndex = Math.floor(Math.random() * suggestions.length);
  return suggestions[randomIndex];
}

function getRandomTitle(titles: string[]): string {
  return titles[Math.floor(Math.random() * titles.length)];
}

export function getArchetypeDriftTitle(archetype: Archetype, name: string): string {
  const generators = ARCHETYPE_DRIFT_TITLES[archetype] || ARCHETYPE_DRIFT_TITLES['Unknown'];
  return getRandomTitle(generators(name));
}

export function getArchetypeThrivingTitle(archetype: Archetype, name: string): string {
  const generators = ARCHETYPE_THRIVING_TITLES[archetype] || ARCHETYPE_THRIVING_TITLES['Unknown'];
  return getRandomTitle(generators(name));
}

export function getArchetypeWarmingTitle(archetype: Archetype, name: string): string {
  const generators = ARCHETYPE_WARMING_TITLES[archetype] || ARCHETYPE_WARMING_TITLES['Unknown'];
  return getRandomTitle(generators(name));
}

export function getArchetypeDormantTitle(archetype: Archetype, name: string): string {
  const generators = ARCHETYPE_DORMANT_TITLES[archetype] || ARCHETYPE_DORMANT_TITLES['Unknown'];
  return getRandomTitle(generators(name));
}

export function getArchetypeNewTitle(archetype: Archetype, name: string): string {
  const generators = ARCHETYPE_NEW_TITLES[archetype] || ARCHETYPE_NEW_TITLES['Unknown'];
  return getRandomTitle(generators(name));
}
