import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { ArrowLeft, ArrowRight, Users, Star, Heart, Lock, CloudOff, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';
import type { Contact } from 'expo-contacts';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { theme } from '../src/theme';
import { type Archetype, type FriendFormData, type MockContact } from '../src/components/types';
import { useFriendStore } from '../src/stores/friendStore';

// Existing components (keep)
import { AnimatedThoughtBubbles } from '../src/components/onboarding/AnimatedThoughtBubbles';
import { TierCard } from '../src/components/onboarding/TierCard';
import { ContactPickerGrid } from '../src/components/onboarding/ContactPickerGrid';
import { ArchetypeQuiz } from '../src/components/onboarding/ArchetypeQuiz';
import { PrivacyPromise } from '../src/components/onboarding/PrivacyPromise';
import { AddConnectionChoice } from '../src/components/onboarding/AddConnectionChoice';
import { ManualAddFriendForm } from '../src/components/onboarding/ManualAddFriendForm';

// New components
import { ThreePathwaysExplainer } from '../src/components/onboarding/ThreePathwaysExplainer';
import { ArchetypeExplainer } from '../src/components/onboarding/ArchetypeExplainer';
import { ArchetypeImpactDemo } from '../src/components/onboarding/ArchetypeImpactDemo';
import { QuickWeaveExplainer, IntentionExplainer, PlanningExplainer } from '../src/components/onboarding/TutorialExplainers';
import { PathwayIntegration } from '../src/components/onboarding/PathwayIntegration';
import { GuidanceLayerExplainer } from '../src/components/onboarding/GuidanceLayerExplainer';

const tierCards = [
  {
    icon: <Heart size={24} color={theme.colors.primary} />,
    title: "Inner Circle (Up to 15)",
    description: "Your ride-or-dies. The people you trust with anything.",
  },
  {
    icon: <Star size={24} color={theme.colors.primary} />,
    title: "Close Friends (Up to 50)",
    description: "Important people you share a strong, mutual bond with.",
  },
  {
    icon: <Users size={24} color={theme.colors.primary} />,
    title: "Community (Up to 150)",
    description: "Friends and acquaintances who enrich your life.",
  },
];

const privacyPromises = [
  {
    icon: <Lock size={24} color={theme.colors.primary} />,
    title: "Private by Design",
    description: "Your data is stored locally on your device. We don't have access to it.",
  },
  {
    icon: <CloudOff size={24} color={theme.colors.primary} />,
    title: "No Cloud, No Problem",
    description: "Weave works entirely offline. Your personal relationship data never leaves your phone.",
  },
  {
    icon: <Shield size={24} color={theme.colors.primary} />,
    title: "You Are Not the Product",
    description: "We will never sell your data or use it for advertising. Our business model is aligned with your privacy.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const addFriend = useFriendStore(state => state.addFriend);

  // State management
  const [currentStep, setCurrentStep] = useState(0);
  const [circlesStep, setCirclesStep] = useState<'intro' | 'choice' | 'picker' | 'manual'>('intro');
  const [friendsForQuiz, setFriendsForQuiz] = useState<(Contact | MockContact)[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Archetype>>({});

  // New comprehensive step flow
  const steps = [
    'hook',              // 0: Emotional hook
    'pathways',          // 1: Three pathways explanation
    'archetype-intro',   // 2: What are archetypes
    'archetype-impact',  // 3: Why they matter (scoring)
    'circles',           // 4: Add first friend + tier selection
    'archetypes',        // 5: Archetype quiz
    'quickweave',        // 6: Logging tutorial
    'intentions',        // 7: Intentions tutorial
    'planning',          // 8: Planning tutorial
    'integration',       // 9: How they work together
    'guidance',          // 10: Today's Focus widget
    'privacy',           // 11: Privacy promise
  ];

  const currentStepName = steps[currentStep];

  const onComplete = () => {
    router.replace('/home');
  };

  const onSkip = () => {
    router.replace('/home');
  };

  const isLastStep = currentStep === steps.length - 1;

  const handleNext = async (newAssignments?: Record<string, Archetype>) => {
    const assignmentsToUse = newAssignments || assignments;

    if (currentStepName === 'circles') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (currentStepName === 'archetypes') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      for (const friend of friendsForQuiz) {
        if (friend.id && assignmentsToUse[friend.id]) {
          const friendData: FriendFormData = {
            name: friend.name,
            tier: 'inner',
            archetype: assignmentsToUse[friend.id],
            notes: '',
            photoUrl: friend.imageAvailable ? friend.image!.uri : '',
          };
          await addFriend(friendData);
        }
      }
    }

    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    if (currentStepName === 'circles' && circlesStep !== 'intro') {
      setCirclesStep('intro');
    } else {
      setCurrentStep(prev => Math.max(0, prev - 1));
    }
  };

  const handleQuizComplete = (newAssignments: Record<string, Archetype>) => {
    setAssignments(newAssignments);
    handleNext(newAssignments);
  };

  const handleCircleChoice = (choice: 'contacts' | 'manual') => {
    if (choice === 'contacts') {
      (async () => {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === 'granted') {
          setCirclesStep('picker');
        } else {
          Alert.alert(
            'Permission Denied',
            'To import friends from your contacts, please grant contacts permission in your settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      })();
    } else {
      setCirclesStep('manual');
    }
  };

  const handleManualAddComplete = async (friendData: FriendFormData) => {
    const mockContact: MockContact = {
      id: uuidv4(),
      name: friendData.name,
      imageAvailable: !!friendData.photoUrl,
      image: friendData.photoUrl ? { uri: friendData.photoUrl } : undefined,
    };
    setFriendsForQuiz([mockContact]);
    setCurrentStep(steps.indexOf('archetypes'));
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStepName) {
      case 'hook':
        return (
          <Animated.View style={styles.fullContent} entering={FadeInDown.duration(600)}>
            <Text style={styles.hookTitle}>When did you last talk to...</Text>
            <AnimatedThoughtBubbles phrases={["your sister?", "your best friend?", "your college roommate?"]} />
            <Text style={styles.hookSubtitle}>Think of someone you care about deeply. When did you last connect?</Text>
            <Text style={styles.hookSubtext}>Life gets busy. Friendships fade without intention.{'\n\n'}Weave helps you stay connected—not through guilt, but through gentle guidance and intentional care.</Text>
          </Animated.View>
        );

      case 'pathways':
        return <ThreePathwaysExplainer />;

      case 'archetype-intro':
        return <ArchetypeExplainer />;

      case 'archetype-impact':
        return <ArchetypeImpactDemo />;

      case 'circles':
        switch (circlesStep) {
          case 'intro':
            return (
              <Animated.View style={styles.fullContent} entering={FadeInDown.duration(600)}>
                <Text style={styles.title}>Your Three Circles</Text>
                <Text style={styles.subtitle}>We'll start with your inner circle—the people who matter most.</Text>
                <View style={styles.tierCardContainer}>
                  {tierCards.map((card, index) => (
                    <TierCard key={index} icon={card.icon} title={card.title} description={card.description} />
                  ))}
                </View>
                <TouchableOpacity onPress={() => setCirclesStep('choice')} style={styles.startButton}>
                  <Text style={styles.startButtonText}>Got it — Let's start</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          case 'choice':
            return <AddConnectionChoice onChoice={handleCircleChoice} />;
          case 'picker':
            return <ContactPickerGrid maxSelection={3} onSelectionChange={setFriendsForQuiz} />;
          case 'manual':
            return <ManualAddFriendForm onComplete={handleManualAddComplete} />;
          default:
            return null;
        }

      case 'archetypes':
        return <ArchetypeQuiz friends={friendsForQuiz} onComplete={handleQuizComplete} />;

      case 'quickweave':
        return <QuickWeaveExplainer />;

      case 'intentions':
        return <IntentionExplainer />;

      case 'planning':
        return <PlanningExplainer />;

      case 'integration':
        return <PathwayIntegration />;

      case 'guidance':
        return <GuidanceLayerExplainer />;

      case 'privacy':
        return (
          <Animated.View style={styles.fullContent} entering={FadeInDown.duration(600)}>
            <Text style={styles.title}>Your Privacy, Your Sanctuary</Text>
            <Text style={styles.subtitle}>We believe your relationships are yours alone.</Text>
            <View style={styles.privacyPromiseContainer}>
              {privacyPromises.map((promise, index) => (
                <PrivacyPromise key={index} icon={promise.icon} title={promise.title} description={promise.description} />
              ))}
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {currentStep > 0 && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
        </View>
        <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {currentStepName === 'circles' && circlesStep === 'picker' ? (
        renderStepContent()
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {renderStepContent()}
        </ScrollView>
      )}

      {currentStepName === 'circles' && (circlesStep === 'intro' || circlesStep === 'choice' || circlesStep === 'manual') ? null : (
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextButton, isLastStep && styles.finishButton]}
          >
            <Text style={styles.nextButtonText}>{isLastStep ? 'Enter Weave' : 'Continue'}</Text>
            {!isLastStep && <ArrowRight size={20} color="white" />}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    height: 60,
  },
  backButton: {
    padding: 8,
  },
  progressContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.colors.secondary,
    borderRadius: 4,
    marginHorizontal: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fullContent: {
    alignItems: 'center',
    width: '100%',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButton: {
    backgroundColor: theme.colors.accent,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  hookTitle: {
    fontSize: 32,
    fontFamily: 'Lora_700Bold',
    textAlign: 'center',
    color: theme.colors.foreground,
    marginBottom: 24,
  },
  hookSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginTop: 24,
    lineHeight: 28,
  },
  hookSubtext: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginTop: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Lora_700Bold',
    textAlign: 'center',
    color: theme.colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginBottom: 32,
    maxWidth: '80%',
  },
  tierCardContainer: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  startButton: {
    marginTop: 32,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  privacyPromiseContainer: {
    width: '100%',
    marginTop: 24,
  },
});
