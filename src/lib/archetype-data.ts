import { type Archetype } from '../components/types';

export const ARCHETYPE_NAMES: Archetype[] = [
  "Emperor",
  "Empress",
  "HighPriestess",
  "Fool",
  "Sun",
  "Hermit",
  "Magician",
  "Lovers",
];

export const ARCHETYPE_DETAILS: Record<Archetype, { essence: string; connectionStyle: string; icon: string }> = {
  Emperor: {
    essence: "Represents structure, authority, and leadership. They are builders and protectors.",
    connectionStyle: "Connects through shared goals, mutual respect, and providing stability.",
    icon: "Crown",
  },
  Empress: {
    essence: "Embodies nurturing, creativity, and abundance. They are caretakers and artists.",
    connectionStyle: "Connects through emotional support, shared creative pursuits, and acts of service.",
    icon: "Flower2",
  },
  HighPriestess: {
    essence: "Symbolizes intuition, mystery, and inner wisdom. They are deep thinkers and observers.",
    connectionStyle: "Connects through deep, meaningful conversations and shared moments of quiet understanding.",
    icon: "Moon",
  },
  Fool: {
    essence: "Represents new beginnings, spontaneity, and faith in the unknown. They are adventurers.",
    connectionStyle: "Connects through shared experiences, laughter, and embracing spontaneity.",
    icon: "Feather",
  },
  Sun: {
    essence: "Signifies joy, vitality, and clarity. They are optimistic and bring light to others.",
    connectionStyle: "Connects through positive energy, shared fun, and celebrating successes.",
    icon: "Sun",
  },
  Hermit: {
    essence: "Stands for introspection, guidance, and solitude. They are wise souls who seek truth.",
    connectionStyle: "Connects through one-on-one deep discussions and respecting each other's need for space.",
    icon: "Mountain",
  },
  Magician: {
    essence: "Represents willpower, manifestation, and resourcefulness. They are creators and problem-solvers.",
    connectionStyle: "Connects by collaborating on projects, teaching or learning skills, and making things happen.",
    icon: "Sparkles",
  },
  Lovers: {
    essence: "Represents harmony, choice, and the beauty of a mirrored soul. They thrive in balanced partnership.",
    connectionStyle: "Connects through deep reciprocal dialogue, finding perfect alignment in values and humor, and celebrating we-ness.",
    icon: "GitMerge",
  },
};
