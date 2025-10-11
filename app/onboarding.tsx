import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ArrowRight, Heart, UserPlus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { theme } from '../src/theme';
import { type Archetype } from '../src/components/types';
import { ArchetypeCard } from '../src/components/archetype-card';

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const onComplete = () => {
    router.replace('/dashboard');
  };

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to Weave',
      subtitle: 'Strengthen your relationships with intention',
      content: (
        <View style={styles.stepContentContainer}>
          <Text style={styles.emoji}>🕸️</Text>
          <Text style={styles.stepSubtext}>
            Build and maintain meaningful connections using the science of human relationships.
          </Text>
        </View>
      ),
    },
    {
      id: 'tiers',
      title: 'Three Circles of Connection',
      subtitle: "Based on Dunbar's Number research",
      content: (
        <View style={styles.stepContentContainer}>
          <View style={styles.tiersRingLg}>
            <View style={styles.tiersRingMd}>
              <View style={styles.tiersRingSm}>
                <Heart color="white" size={32} />
              </View>
            </View>
          </View>
          <View style={{ gap: 24 }}>
            <TierInfo color="#7A9471" title="Inner Circle (5-15)" subtitle="Your closest relationships" />
            <TierInfo color="#D4A574" title="Close Friends (50)" subtitle="Meaningful friendships" />
            <TierInfo color="#C17B63" title="Community (150)" subtitle="Your broader social network" />
          </View>
        </View>
      ),
    },
    {
      id: 'archetypes',
      title: 'Archetypes',
      subtitle: 'A tool for empathy and understanding',
      content: (
        <View style={styles.stepContentContainer}>
          <View style={styles.archetypeGrid}>
            {["Emperor", "Empress", "HighPriestess", "Fool", "Sun", "Hermit", "Magician"].map(archetype => (
              <View key={archetype} style={{ width: '22%' }}>
                <ArchetypeCard archetype={archetype as Archetype} />
              </View>
            ))}
          </View>
          <Text style={styles.stepSubtext}>
            <Text style={{ fontWeight: 'bold' }}>Tap and hold any archetype</Text> to learn about their essence and connection style.
          </Text>
        </View>
      ),
    },
    {
      id: 'start',
      title: 'Ready to Begin?',
      subtitle: 'Start building your weave',
      content: (
        <View style={styles.stepContentContainer}>
          <View style={styles.startIconContainer}>
            <UserPlus color="white" size={40} />
          </View>
          <Text style={styles.stepSubtext}>
            Add your first Inner Circle friend and begin strengthening your most important relationships.
          </Text>
        </View>
      ),
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

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
        <Text style={styles.title}>{currentStepData.title}</Text>
        <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {currentStepData.content}
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ width: 80 }}>
          {currentStep > 0 && (
            <TouchableOpacity onPress={() => setCurrentStep(currentStep - 1)} style={{ padding: 8 }}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>{isLastStep ? 'Get Started' : 'Continue'}</Text>
          <ArrowRight color="white" size={20} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const TierInfo = ({ color, title, subtitle }: { color: string, title: string, subtitle: string }) => (
    <View style={styles.tierInfoContainer}>
        <View style={[styles.tierInfoDot, { backgroundColor: color }]} />
        <View>
            <Text style={styles.tierInfoTitle}>{title}</Text>
            <Text style={styles.tierInfoSubtitle}>{subtitle}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  progressBarContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  progressPill: {
    height: 8,
    flex: 1,
    borderRadius: 4,
  },
  headerContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    color: theme.colors.foreground,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors['muted-foreground'],
    textAlign: 'center',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 120, // Space for the footer
  },
  stepContentContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 32,
  },
  stepSubtext: {
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    lineHeight: 28,
    maxWidth: 300,
  },
  tiersRingLg: {
    width: 224,
    height: 224,
    borderRadius: 112,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: '#C17B63',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  tiersRingMd: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 4,
    borderStyle: 'dashed',
    borderColor: '#D4A574',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiersRingSm: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7A9471',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tierInfoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  tierInfoDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
  },
  tierInfoTitle: {
      fontWeight: '500',
      fontSize: 18,
      color: '#3C3C3C',
  },
  tierInfoSubtitle: {
      color: '#8A8A8A',
  },
  archetypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 48,
  },
  startIconContainer: {
      width: 96,
      height: 96,
      backgroundColor: theme.colors.primary,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: theme.colors['muted-foreground'],
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
  },
});