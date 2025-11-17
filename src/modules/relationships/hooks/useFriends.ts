// src/modules/relationships/hooks/useFriends.ts
import { useEffect } from 'react';
import { useRelationshipsStore } from '../store';

export const useFriends = () => {
  const { friends, observeFriends, unobserveFriends } = useRelationshipsStore();

  useEffect(() => {
    observeFriends();
    return () => {
      unobserveFriends();
    };
  }, [observeFriends, unobserveFriends]);

  return friends;
};
