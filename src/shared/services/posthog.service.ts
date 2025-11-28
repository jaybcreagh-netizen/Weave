import { PostHogProvider, usePostHog, PostHog, PostHogOptions } from 'posthog-react-native';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// TODO: Replace with actual API Key and Host
export const POSTHOG_API_KEY = 'phc_7zVVcjN8nMJWbw2XgIANio1B7EqNUn4jxWiZZzGActJ';
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

export const posthogOptions: PostHogOptions | any = {
    host: POSTHOG_HOST,

    // Use file system for caching to ensure persistence
    persistence: 'file',
    fileSystem: FileSystem,
};

// Export the provider for wrapping the app
export { PostHogProvider };

// Export the hook for using PostHog in components
export { usePostHog };

// Export the type
export type { PostHog };
