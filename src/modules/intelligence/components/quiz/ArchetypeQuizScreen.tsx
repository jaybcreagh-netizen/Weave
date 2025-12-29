/**
 * ArchetypeQuizScreen
 * 
 * Main quiz flow container with smooth animated transitions:
 * Intro → Questions (8) → Calculating → Result
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing,
    FadeIn,
    FadeOut,
    SlideInRight,
    SlideOutLeft,
    SlideInLeft,
    SlideOutRight,
} from 'react-native-reanimated';

import { useTheme } from '@/shared/hooks/useTheme';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { getCurrentSession } from '@/modules/auth/services/supabase-auth.service';

import { QuizIntro } from './QuizIntro';
import { QuizProgress } from './QuizProgress';
import { QuizQuestion } from './QuizQuestion';
import { QuizCalculating } from './QuizCalculating';
import { QuizResult } from './QuizResult';
import {
    QUIZ_QUESTIONS,
    SliderPosition,
    QuizAnswer,
    QuizResult as QuizResultType,
    calculateQuizResults,
    areAllAnswersCentered,
} from '../../services/quiz';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

type QuizStage = 'intro' | 'questions' | 'calculating' | 'result';

// Animation presets
const FADE_DURATION = 300;
const SLIDE_DURATION = 350;

export function ArchetypeQuizScreen() {
    const { colors } = useTheme();

    const [stage, setStage] = useState<QuizStage>('intro');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<QuizAnswer[]>([]);
    const [result, setResult] = useState<QuizResultType | null>(null);
    const [slideDirection, setSlideDirection] = useState<'forward' | 'back'>('forward');

    // Track question key for animations
    const [questionKey, setQuestionKey] = useState(0);

    const handleStart = useCallback(() => {
        setSlideDirection('forward');
        setStage('questions');
        setCurrentQuestion(0);
        setAnswers([]);
        setQuestionKey(0);
    }, []);

    const handleAnswer = useCallback((sliderValue: SliderPosition) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = {
            questionId: QUIZ_QUESTIONS[currentQuestion].id,
            sliderValue,
        };
        setAnswers(newAnswers);

        if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
            // Move to next question with forward animation
            setSlideDirection('forward');
            setQuestionKey(prev => prev + 1);
            setCurrentQuestion(currentQuestion + 1);
        } else {
            // All questions answered - check for all centered
            if (areAllAnswersCentered(newAnswers)) {
                Alert.alert(
                    "All centred answers",
                    "Looks like you're right in the middle on everything. Want to revisit any questions, or see your balanced result?",
                    [
                        { text: "See result", onPress: () => proceedToCalculating(newAnswers) },
                        { text: "Go back", onPress: () => setCurrentQuestion(0) },
                    ]
                );
            } else {
                proceedToCalculating(newAnswers);
            }
        }
    }, [answers, currentQuestion]);

    const proceedToCalculating = (finalAnswers: QuizAnswer[]) => {
        setSlideDirection('forward');
        setStage('calculating');
        // Calculate result now so it's ready when calculating finishes
        const calculatedResult = calculateQuizResults(finalAnswers);
        setResult(calculatedResult);
    };

    const handleCalculatingComplete = useCallback(() => {
        setSlideDirection('forward');
        setStage('result');
    }, []);

    const handleBack = useCallback(() => {
        if (currentQuestion > 0) {
            setSlideDirection('back');
            setQuestionKey(prev => prev - 1);
            setCurrentQuestion(currentQuestion - 1);
        }
    }, [currentQuestion]);

    const handleSaveToProfile = useCallback(async () => {
        if (!result) return;

        try {
            const session = await getCurrentSession();
            if (!session) {
                Alert.alert('Error', 'Not signed in');
                return;
            }

            const client = getSupabaseClient();
            if (!client) {
                Alert.alert('Error', 'Could not connect to server');
                return;
            }

            // Update existing profile (profile should exist from auth signup)
            const { error } = await client
                .from('user_profiles')
                .update({
                    archetype: result.primary,
                    quiz_result: {
                        primary: result.primary,
                        secondary: result.secondary,
                        scores: result.scores,
                        takenAt: new Date().toISOString(),
                        version: '1.0',
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', session.userId);

            if (error) {
                console.error('Quiz save error:', error);
                Alert.alert('Error', `Could not save result: ${error.message}`);
                return;
            }

            Alert.alert(
                'Saved!',
                `Your archetype is ${result.primary}`,
                [{
                    text: 'OK', onPress: () => {
                        // Mark quiz as taken
                        useTutorialStore.getState().markQuizTaken();
                        router.back();
                    }
                }]
            );
        } catch (err) {
            console.error('Quiz save exception:', err);
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        }
    }, [result]);

    const handleClose = useCallback(() => {
        router.back();
    }, []);

    const handleRetake = useCallback(() => {
        handleStart();
    }, [handleStart]);

    // Get appropriate entering animation based on direction
    const getEnteringAnimation = () => {
        return slideDirection === 'forward'
            ? SlideInRight.duration(SLIDE_DURATION).easing(Easing.out(Easing.cubic))
            : SlideInLeft.duration(SLIDE_DURATION).easing(Easing.out(Easing.cubic));
    };

    const getExitingAnimation = () => {
        return slideDirection === 'forward'
            ? SlideOutLeft.duration(SLIDE_DURATION).easing(Easing.in(Easing.cubic))
            : SlideOutRight.duration(SLIDE_DURATION).easing(Easing.in(Easing.cubic));
    };

    return (
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            {stage === 'intro' && (
                <Animated.View
                    className="flex-1"
                    entering={FadeIn.duration(FADE_DURATION)}
                    exiting={FadeOut.duration(FADE_DURATION)}
                >
                    <QuizIntro onStart={handleStart} />
                </Animated.View>
            )}

            {stage === 'questions' && (
                <Animated.View
                    className="flex-1"
                    entering={FadeIn.duration(FADE_DURATION)}
                    exiting={FadeOut.duration(FADE_DURATION)}
                >
                    <QuizProgress
                        current={currentQuestion + 1}
                        total={QUIZ_QUESTIONS.length}
                    />
                    <Animated.View
                        key={questionKey}
                        className="flex-1"
                        entering={getEnteringAnimation()}
                        exiting={getExitingAnimation()}
                    >
                        <QuizQuestion
                            question={QUIZ_QUESTIONS[currentQuestion]}
                            onAnswer={handleAnswer}
                            onBack={handleBack}
                            isFirst={currentQuestion === 0}
                        />
                    </Animated.View>
                </Animated.View>
            )}

            {stage === 'calculating' && (
                <Animated.View
                    className="flex-1"
                    entering={FadeIn.duration(FADE_DURATION)}
                    exiting={FadeOut.duration(FADE_DURATION)}
                >
                    <QuizCalculating onComplete={handleCalculatingComplete} />
                </Animated.View>
            )}

            {stage === 'result' && result && (
                <Animated.View
                    className="flex-1"
                    entering={FadeIn.duration(FADE_DURATION * 1.5)}
                >
                    <QuizResult
                        result={result}
                        onSaveToProfile={handleSaveToProfile}
                        onRetake={handleRetake}
                        onClose={handleClose}
                    />
                </Animated.View>
            )}
        </SafeAreaView>
    );
}
