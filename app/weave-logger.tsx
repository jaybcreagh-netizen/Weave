import { useRouter, useLocalSearchParams } from 'expo-router';
import { WeaveLoggerScreen } from '@/modules/interactions';
import { InteractionCategory } from '@/shared/types/legacy-types';

export default function WeaveLoggerRoute() {
  const router = useRouter();
  const { friendId, date, category, notes, title } = useLocalSearchParams<{
    friendId: string;
    date?: string;
    category?: string;
    notes?: string;
    title?: string;
  }>();

  return (
    <WeaveLoggerScreen
      friendId={friendId}
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
