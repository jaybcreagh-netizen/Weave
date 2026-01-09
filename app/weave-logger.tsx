import { useRouter, useLocalSearchParams } from 'expo-router';
import { WeaveLoggerScreen } from '@/modules/interactions';
import { InteractionCategory } from '@/shared/types/legacy-types';

// Route wrapper for Weave Logger
export default function WeaveLoggerRoute() {
  const router = useRouter();
  const { friendId, friendIds, date, category, notes, title } = useLocalSearchParams<{
    friendId?: string;
    friendIds?: string;
    date?: string;
    category?: string;
    notes?: string;
    title?: string;
  }>();

  // Support both single friendId and comma-separated friendIds
  // The screen handles multiple friends internally via its friend selector
  const initialFriendId = friendId || (friendIds ? friendIds.split(',')[0] : undefined);

  return (
    <WeaveLoggerScreen
      friendId={initialFriendId}
      friendIds={friendIds ? friendIds.split(',') : undefined}
      date={date}
      category={category as InteractionCategory} // Type assertion as string comes from params
      notes={notes}
      title={title}
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
