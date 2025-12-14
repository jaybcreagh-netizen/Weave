import { useRouter, useLocalSearchParams } from 'expo-router';
import { WeaveLoggerScreen } from '@/modules/interactions';

export default function WeaveLoggerRoute() {
  const router = useRouter();
  const { friendId } = useLocalSearchParams<{ friendId: string }>();

  return (
    <WeaveLoggerScreen
      friendId={friendId}
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
