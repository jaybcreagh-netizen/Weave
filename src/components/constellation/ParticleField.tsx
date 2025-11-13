/**
 * ParticleField Component
 * Renders ambient floating particles using Skia
 */

import React, { useMemo } from 'react';
import { Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { ParticleConfig } from './types';
import { CANVAS_SIZE } from './config';
import { getSeededRandom } from './utils';

interface Particle {
  id: string;
  initialX: number;
  initialY: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phaseOffset: number; // For opacity pulsing
}

interface ParticleFieldProps {
  config: ParticleConfig;
  progress: number; // Animation progress (0-1, loops)
  width?: number;
  height?: number;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  config,
  progress,
  width = CANVAS_SIZE.width,
  height = CANVAS_SIZE.height,
}) => {
  // Generate particles with deterministic randomness
  const particles = useMemo(() => {
    const particleArray: Particle[] = [];

    for (let i = 0; i < config.count; i++) {
      const seed = `particle-${i}`;
      const random1 = getSeededRandom(seed + '-1');
      const random2 = getSeededRandom(seed + '-2');
      const random3 = getSeededRandom(seed + '-3');
      const random4 = getSeededRandom(seed + '-4');
      const random5 = getSeededRandom(seed + '-5');
      const random6 = getSeededRandom(seed + '-6');

      particleArray.push({
        id: seed,
        initialX: random1 * width,
        initialY: random2 * height,
        vx: (random3 - 0.5) * config.speed,
        vy: (random4 - 0.5) * config.speed,
        size: config.minSize + random5 * (config.maxSize - config.minSize),
        opacity: config.minOpacity + random6 * (config.maxOpacity - config.minOpacity),
        phaseOffset: random1 * Math.PI * 2, // Random phase for pulsing
      });
    }

    return particleArray;
  }, [config, width, height]);

  return (
    <Group>
      {particles.map((particle) => (
        <ParticleCircle
          key={particle.id}
          particle={particle}
          progress={progress}
          color={config.color}
          width={width}
          height={height}
        />
      ))}
    </Group>
  );
};

interface ParticleCircleProps {
  particle: Particle;
  progress: number;
  color: string;
  width: number;
  height: number;
}

const ParticleCircle: React.FC<ParticleCircleProps> = ({
  particle,
  progress,
  color,
  width,
  height,
}) => {
  // Calculate current position with wrapping
  const x = useDerivedValue(() => {
    const newX = particle.initialX + particle.vx * progress * 100;
    return ((newX % width) + width) % width;
  }, [progress, particle, width]);

  const y = useDerivedValue(() => {
    const newY = particle.initialY + particle.vy * progress * 100;
    return ((newY % height) + height) % height;
  }, [progress, particle, height]);

  // Pulsing opacity
  const opacity = useDerivedValue(() => {
    const pulse = Math.sin(progress * Math.PI * 2 + particle.phaseOffset);
    return particle.opacity * (0.7 + 0.3 * pulse);
  }, [progress, particle]);

  return (
    <Circle cx={x} cy={y} r={particle.size} opacity={opacity}>
      <RadialGradient
        c={vec(particle.size, particle.size)}
        r={particle.size}
        colors={[color, color + '00']} // Fade to transparent
      />
    </Circle>
  );
};
