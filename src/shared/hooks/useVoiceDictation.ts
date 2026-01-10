/**
 * useVoiceDictation - Hook for speech-to-text integration
 * 
 * PROTOTYPE SKETCH - Not production ready
 * This demonstrates the pattern for integrating voice dictation
 * with your existing text inputs.
 * 
 * Dependencies to install:
 *   npx expo install expo-speech-recognition
 *   OR
 *   npm install @react-native-voice/voice
 */

import { useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';

// TODO: Replace with actual speech recognition library
// import ExpoSpeechRecognitionModule from 'expo-speech-recognition';
// OR
// import Voice from '@react-native-voice/voice';

export interface VoiceDictationOptions {
    /** Language code (e.g., 'en-US', 'en-GB') */
    language?: string;
    /** Called when partial results are available */
    onPartialResult?: (text: string) => void;
    /** Called when final result is ready */
    onResult?: (text: string) => void;
    /** Called on error */
    onError?: (error: Error) => void;
}

export interface VoiceDictationState {
    /** Whether currently recording */
    isRecording: boolean;
    /** Whether speech recognition is available */
    isAvailable: boolean;
    /** Current partial transcript while recording */
    partialText: string;
    /** Final transcript after recording stops */
    finalText: string;
    /** Any error that occurred */
    error: Error | null;
}

export interface VoiceDictationActions {
    /** Start recording */
    startRecording: () => Promise<void>;
    /** Stop recording and get final result */
    stopRecording: () => Promise<string>;
    /** Cancel recording without result */
    cancelRecording: () => void;
    /** Reset state */
    reset: () => void;
}

export function useVoiceDictation(
    options: VoiceDictationOptions = {}
): VoiceDictationState & VoiceDictationActions {
    const { language = 'en-US', onPartialResult, onResult, onError } = options;

    const [isRecording, setIsRecording] = useState(false);
    const [isAvailable, setIsAvailable] = useState(true); // Check on mount
    const [partialText, setPartialText] = useState('');
    const [finalText, setFinalText] = useState('');
    const [error, setError] = useState<Error | null>(null);

    // Store final result for promise resolution
    const resultRef = useRef<string>('');
    const resolveRef = useRef<((value: string) => void) | null>(null);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setPartialText('');
            setFinalText('');

            // TODO: Request microphone permission
            // const { status } = await Audio.requestPermissionsAsync();
            // if (status !== 'granted') {
            //   throw new Error('Microphone permission denied');
            // }

            // TODO: Start speech recognition
            // await ExpoSpeechRecognitionModule.start({
            //   lang: language,
            //   interimResults: true,
            //   maxAlternatives: 1,
            // });

            setIsRecording(true);

            // MOCK: Simulate recording for prototype demo
            console.log('[VoiceDictation] Started recording...');

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to start recording');
            setError(error);
            onError?.(error);
        }
    }, [language, onError]);

    const stopRecording = useCallback(async (): Promise<string> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;

            // TODO: Stop speech recognition
            // await ExpoSpeechRecognitionModule.stop();

            setIsRecording(false);

            // MOCK: Simulate result for prototype demo
            const mockResult = partialText || '';
            setFinalText(mockResult);
            onResult?.(mockResult);
            resolve(mockResult);

            console.log('[VoiceDictation] Stopped recording, result:', mockResult);
        });
    }, [partialText, onResult]);

    const cancelRecording = useCallback(() => {
        // TODO: Cancel speech recognition
        // ExpoSpeechRecognitionModule.cancel();

        setIsRecording(false);
        setPartialText('');
        resolveRef.current?.('');
        resolveRef.current = null;

        console.log('[VoiceDictation] Cancelled recording');
    }, []);

    const reset = useCallback(() => {
        setIsRecording(false);
        setPartialText('');
        setFinalText('');
        setError(null);
    }, []);

    // TODO: Set up speech recognition event listeners on mount
    // useEffect(() => {
    //   const onSpeechResults = (event) => {
    //     const text = event.value?.[0] || '';
    //     setFinalText(text);
    //     onResult?.(text);
    //     resolveRef.current?.(text);
    //   };
    //
    //   const onSpeechPartialResults = (event) => {
    //     const text = event.value?.[0] || '';
    //     setPartialText(text);
    //     onPartialResult?.(text);
    //   };
    //
    //   Voice.onSpeechResults = onSpeechResults;
    //   Voice.onSpeechPartialResults = onSpeechPartialResults;
    //
    //   return () => {
    //     Voice.destroy();
    //   };
    // }, [onResult, onPartialResult]);

    return {
        // State
        isRecording,
        isAvailable,
        partialText,
        finalText,
        error,
        // Actions
        startRecording,
        stopRecording,
        cancelRecording,
        reset,
    };
}
