import { useRouter, useLocalSearchParams } from 'expo-router';
import { WeaveLoggerScreen } from '@/modules/interactions';
import { InteractionCategory } from '@/shared/types/legacy-types';

type SearchParam = string | string[] | undefined;

const firstParam = (value: SearchParam): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const listParam = (value: SearchParam): string[] | undefined => {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : [value];
  const parsed = values
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
};

// Route wrapper for Weave Logger
export default function WeaveLoggerRoute() {
  const router = useRouter();
  const {
    friendId,
    friendIds,
    date,
    category,
    initialCategory,
    notes,
    title,
    location,
    mode,
    type,
  } = useLocalSearchParams<{
    friendId?: string | string[];
    friendIds?: string | string[];
    date?: string | string[];
    category?: string | string[];
    initialCategory?: string | string[];
    notes?: string | string[];
    title?: string | string[];
    location?: string | string[];
    mode?: string | string[];
    type?: string | string[];
  }>();

  const parsedFriendIds = listParam(friendIds);
  const parsedFriendId = firstParam(friendId);
  const parsedCategory = (firstParam(category) || firstParam(initialCategory)) as InteractionCategory | undefined;
  const parsedMode = firstParam(mode) || firstParam(type);
  const interactionMode: 'log' | 'plan' = parsedMode === 'plan' ? 'plan' : 'log';

  // Support both single friendId and comma-separated friendIds.
  const initialFriendId = parsedFriendId || parsedFriendIds?.[0];

  return (
    <WeaveLoggerScreen
      mode={interactionMode}
      friendId={initialFriendId}
      friendIds={parsedFriendIds}
      date={firstParam(date)}
      category={parsedCategory}
      notes={firstParam(notes)}
      title={firstParam(title)}
      location={firstParam(location)}
      onBack={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      }}
      onNavigateHome={() => router.replace('/')}
      onNavigateToJournal={(weaveId) => {
        router.replace({
          pathname: '/journal',
          params: {
            mode: 'guided',
            weaveId,
          },
        });
      }}
    />
  );
}
