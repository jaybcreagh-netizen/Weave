import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent, Linking, FlatList } from 'react-native';
import { ArrowLeft, ArrowRight, Mail, CalendarCheck, Users, Star, Heart, Lock, CloudOff, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Contact } from 'expo-contacts';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { theme } from '../src/theme';
import { type Archetype, type FriendFormData, type MockContact } from '../src/components/types';
import { useFriendStore } from '../src/stores/friendStore';
import { AnimatedThoughtBubbles } from '../src/components/onboarding/AnimatedThoughtBubbles';
import { VisionCard } from '../src/components/onboarding/VisionCard';
import { TierCard } from '../src/components/onboarding/TierCard';
import { ContactPickerGrid } from '../src/components/onboarding/ContactPickerGrid';
import { ArchetypeQuiz } from '../src/components/onboarding/ArchetypeQuiz';
import { PrivacyPromise } from '../src/components/onboarding/PrivacyPromise';
import { AddConnectionChoice } from '../src/components/onboarding/AddConnectionChoice';
import { ManualAddFriendForm } from '../src/components/onboarding/ManualAddFriendForm';

const { width } = Dimensions.get('window');

const visionCards = [
  {
    icon: <Mail size={32} color={theme.colors.primary} />,
    title: "Never Lose Touch",
    description: "Get gentle nudges to reconnect before friendships fade, turning good intentions into action.",
  },
  {
    icon: <CalendarCheck size={32} color={theme.colors.primary} />,
    title: "Celebrate the Moments",
    description: "Easily log memories and milestones, creating a rich, shared history of your most important bonds.",
  },
  {
    icon: <Users size={32} color={theme.colors.primary} />,
    title: "Know Your People",
    description: "Understand the rhythm of your social life and see who you're truly connecting with over time.",
  },
];

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
  const [visionPage, setVisionPage] = useState(0);

  // Step configuration
  const steps = ['hook', 'vision', 'circles', 'archetypes', 'privacy'];
  const currentStepName = steps[currentStep];

  const onComplete = () => {
    router.replace('/dashboard');
  };

  const onSkip = () => {
    router.replace('/dashboard');
  };

  const isLastStep = currentStep === steps.length - 1;

  const handleNext = async () => {
    if (currentStepName === 'circles') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (currentStepName === 'archetypes') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      for (const friend of friendsForQuiz) {
        if (friend.id && assignments[friend.id]) {
          const friendData: FriendFormData = {
            name: friend.name,
            tier: 'inner', // Step 3 is for the Inner Circle
            archetype: assignments[friend.id],
            notes: '', // Not collected in onboarding
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
    handleNext();
  };

  const handleManualAddComplete = (friendData: FriendFormData) => {
    const mockContact: MockContact = {
      id: uuidv4(),
      name: friendData.name,
      imageAvailable: !!friendData.photoUrl,
      image: friendData.photoUrl ? { uri: friendData.photoUrl } : undefined,
    };
    setFriendsForQuiz([mockContact]);
    handleNext();
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setVisionPage(pageIndex);
  };

  // Conditional rendering for step content
  const renderStepContent = () => {
    switch (currentStepName) {
      case 'hook':
        return (
            <Animated.View style={{alignItems: 'center'}} entering={FadeInDown.duration(600)}>
              <Text style={styles.hookTitle}>When did you last talk to...</Text>
              <AnimatedThoughtBubbles phrases={["your sister?", "your best friend?", "Your Uni roommate?"]} />
              <Text style={styles.hookSubtitle}>Think of someone you care about deeply. When did you last connect?</Text>
              <Text style={styles.hookSubtext}>Life gets busy... Weave helps you stay close to what matters.</Text>
            </Animated.View>
        );
      case 'vision':
        return (
          <Animated.View style={{alignItems: 'center'}} entering={FadeInDown.duration(600)}>
            <Text style={styles.visionTitle}>Imagine a year from now...</Text>
            <Text style={styles.visionSubtitle}>Where no one slips through the cracks.</Text>
            <FlatList
              horizontal
              data={visionCards}
              renderItem={({ item }) => (
                <VisionCard icon={item.icon} title={item.title} description={item.description} />
              )}
              keyExtractor={(_, index) => index.toString()}
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: (width - (width - 48)) / 2 }}
              snapToInterval={width - 48}
            />
            <View style={styles.paginationContainer}>
              {visionCards.map((_, index) => (
                <View key={index} style={[styles.paginationDot, { opacity: visionPage === index ? 1 : 0.3 }]} />
              ))}
            </View>
          </Animated.View>
        );
      case 'circles':
        switch (circlesStep) {
          case 'intro':
            return (
              <Animated.View style={{alignItems: 'center', width: '100%'}} entering={FadeInDown.duration(600)}>
                  <Text style={styles.visionTitle}>Your Three Circles</Text>
                  <Text style={styles.visionSubtitle}>We'll start with your inner circle—the people who matter most.</Text>
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
            return <AddConnectionChoice onChoice={setCirclesStep} />;
          case 'picker':
            return <ContactPickerGrid maxSelection={3} onSelectionChange={setFriendsForQuiz} />;
          case 'manual':
            return <ManualAddFriendForm onComplete={handleManualAddComplete} />;
          default:
            return null;
        }
      case 'archetypes':
        return <ArchetypeQuiz friends={friendsForQuiz} onComplete={handleQuizComplete} />;
      case 'privacy':
        return (
            <Animated.View style={{alignItems: 'center', width: '100%'}} entering={FadeInDown.duration(600)}>
                <Text style={styles.visionTitle}>Your relationships are yours.</Text>
                <Text style={styles.visionSubtitle}>We believe your personal life is not a product. Here's our promise:</Text>
                <View style={styles.tierCardContainer}>
                    {privacyPromises.map((card, index) => (
                        <PrivacyPromise key={index} icon={card.icon} title={card.title} description={card.description} />
                    ))}
                </View>
                <TouchableOpacity onPress={() => Linking.openURL('https://www.google.com')}>
                    <Text style={styles.linkText}>Read our full Privacy Policy</Text>
                </TouchableOpacity>
            </Animated.View>
        );
      default:
        return null;
    }
  };
  
  const showFooterContinue = !(currentStepName === 'circles' && circlesStep === 'intro');
  const isCirclesContinueDisabled = currentStepName === 'circles' && circlesStep === 'picker' && friendsForQuiz.length === 0;
  const isArchetypesContinueDisabled = currentStepName === 'archetypes' && Object.keys(assignments).length < friendsForQuiz.length;

  const isScrollView = !((currentStepName === 'circles' && (circlesStep === 'picker' || circlesStep === 'manual')) || currentStepName === 'archetypes');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.progressBarContainer}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[styles.progressPill, { backgroundColor: index <= currentStep ? theme.colors.primary : theme.colors.secondary }]}
          />
        ))}
      </View>

      <View style={styles.headerContainer}>
        {currentStep > 0 && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors['muted-foreground']} />
          </TouchableOpacity>
        )}
        {!isLastStep && currentStepName !== 'archetypes' && (
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {isScrollView ? (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {renderStepContent()}
        </ScrollView>
      ) : (
        <View style={styles.contentContainer}>
          {renderStepContent()}
        </View>
      )}

      <View style={styles.footer}>
        {currentStepName === 'circles' && circlesStep === 'picker' ? (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity onPress={handleNext} disabled={isCirclesContinueDisabled} style={[styles.nextButton, isCirclesContinueDisabled && { opacity: 0.5 }]}>
              <ArrowRight color="white" size={24} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {showFooterContinue && currentStepName !== 'archetypes' && (currentStepName !== 'circles' || circlesStep !== 'manual') && (
                <TouchableOpacity onPress={handleNext} disabled={isArchetypesContinueDisabled} style={[styles.nextButton, isArchetypesContinueDisabled && { opacity: 0.5 }]}>
                  <ArrowRight color="white" size={24} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FBF9F7' },
  progressBarContainer: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  progressPill: { height: 8, flex: 1, borderRadius: 4 },
  headerContainer: { 
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    position: 'absolute',
    left: 24,
    padding: 8,
    zIndex: 10,
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    padding: 8,
    zIndex: 10,
  },
  contentContainer: { paddingBottom: 120, justifyContent: 'center', flexGrow: 1 },
  placeholderText: { fontSize: 18, color: theme.colors['muted-foreground'], textAlign: 'center' },
  hookTitle: { fontSize: 32, color: theme.colors.foreground, textAlign: 'center', fontFamily: 'serif', marginBottom: 16 },
  hookSubtitle: { fontSize: 20, color: theme.colors.foreground, textAlign: 'center', fontFamily: 'serif', marginBottom: 12 },
  hookSubtext: { fontSize: 16, color: theme.colors['muted-foreground'], textAlign: 'center', marginTop: 24, lineHeight: 24 },
  visionTitle: { fontSize: 32, color: theme.colors.foreground, textAlign: 'center', fontFamily: 'serif', marginBottom: 8, paddingHorizontal: 24 },
  visionSubtitle: { fontSize: 18, color: theme.colors['muted-foreground'], textAlign: 'center', marginBottom: 32, paddingHorizontal: 24 },
  visionScrollView: { maxHeight: 350 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  paginationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginHorizontal: 4 },
  tierCardContainer: { gap: 12, width: '100%', paddingHorizontal: 24, marginBottom: 32 },
  startButton: { backgroundColor: theme.colors.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  startButtonText: { color: 'white', fontSize: 18, fontWeight: '500' },
  linkText: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
    fontSize: 16,
    marginTop: 24,
  },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'transparent' },
  backButtonText: { fontSize: 18, fontWeight: '500', color: theme.colors['muted-foreground'] },
  skipButtonText: { fontSize: 18, fontWeight: '500', color: theme.colors['muted-foreground'], opacity: 0.7 },
  nextButton: {
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  nextButtonText: { color: 'white', fontSize: 18, fontWeight: '500' },
});