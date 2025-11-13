# Constellation View

A mystical, interactive visualization of your social network using Skia.

## Features

- **Dunbar Rings**: Concentric circles representing Inner Circle, Close Friends, and Community
- **Friend Nodes**: Avatar-based nodes with health-colored glows
- **Connection Lines**: Curved paths with flowing particles
- **Particle Field**: Ambient floating particles that adapt to season
- **Seasonal Themes**: Different color palettes and effects for Resting, Balanced, and Blooming
- **Gestures**: Pinch to zoom, pan to move, double-tap to reset
- **Filters**: Highlight specific tiers, archetypes, or friend states

## Usage

```tsx
import { ConstellationView } from './components/constellation';
import { useConstellationData } from './components/constellation/useConstellationData';
import { useFriends } from './hooks/useFriends';
import { useUserProfileStore } from './stores/userProfileStore';

function MyComponent() {
  const friends = useFriends();
  const { profile } = useUserProfileStore();
  const constellationFriends = useConstellationData(friends);

  return (
    <ConstellationView
      friends={constellationFriends}
      season={profile?.currentSocialSeason || 'balanced'}
      onFriendPress={(id) => console.log('Friend pressed:', id)}
    />
  );
}
```

## Configuration

All visual parameters can be customized in `config.ts`:

- **RING_RADII**: Distance of each Dunbar tier from center
- **PARTICLE_CONFIGS**: Particle count, size, opacity per season
- **NODE_CONFIG**: Friend node size, glow, pulse settings
- **CONNECTION_CONFIG**: Line thickness, particle flow speed
- **SEASON_THEMES**: Colors and gradients for each season
- **ANIMATION_DURATIONS**: Speed of all animations

## Components

### ConstellationView (Main)
The orchestrator that renders everything on a Skia Canvas.

### ParticleField
Floating ambient particles that drift and pulse.

### DunbarRings
Concentric orbital rings with rotation animation.

### ConnectionLines
Curved lines with flowing particles from center to friends.

### FriendNodes
Avatar nodes with health-based glow and momentum pulse.

### CenterNode
The "you" node at the center with seasonal icon.

### ConstellationBackground
Seasonal gradient background.

## Filters

```tsx
<ConstellationView
  friends={constellationFriends}
  season="balanced"
  filter={{ mode: 'fading' }} // Highlight fading friends
/>

<ConstellationView
  filter={{ mode: 'tier', value: 'InnerCircle' }} // Show only Inner Circle
/>

<ConstellationView
  filter={{ mode: 'momentum' }} // Show friends with active momentum
/>
```

## Customization Examples

### Change Ring Radii
```ts
// config.ts
export const RING_RADII = {
  InnerCircle: 100,    // Default: 80
  CloseFriends: 200,   // Default: 150
  Community: 300,      // Default: 230
};
```

### Adjust Particle Count
```ts
// config.ts
export const PARTICLE_CONFIGS = {
  blooming: {
    count: 200,  // More particles for blooming season
    // ...
  },
};
```

### Custom Season Theme
```ts
// config.ts
export const SEASON_THEMES = {
  balanced: {
    backgroundColor: ['#2D1B4E', '#1A0E2E'],  // Custom purple gradient
    particleColor: '#FFD700',                  // Gold particles
    // ...
  },
};
```

## Performance Notes

- Skia renders on GPU for smooth 60fps animations
- Particle system uses shared worklets for efficiency
- Friend positions calculated once and memoized
- For networks with 100+ friends, consider reducing particle count

## Future Enhancements

- [ ] Add zoom/pan transforms to Skia Group (currently gestures detected but not applied)
- [ ] Tap handling on individual friend nodes
- [ ] Export as image/share constellation
- [ ] Animation when friends are added/removed
- [ ] Constellation "constellations" (connect friends who know each other)
