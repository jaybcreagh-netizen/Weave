/**
 * GuidedReflectionModal
 * 
 * Mode 2: Full guided reflection flow with context.
 * 
 * Steps:
 * 1. Context Selection - What's this about? (recent weave, friend, or general)
 * 2. Prompt Selection - Contextual question with alternatives
 * 3. Writing - Rich editor with context panel
 * 
 * Can be opened directly or from QuickCapture's "Expand" action.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  SlideInLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  MessageCircle,
  Sparkles,
  BookOpen,
  Coffee,
  Heart,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import { Q } from '@nozbe/watermelondb';
import * as Haptics from 'expo-haptics';

import {
  getRecentMeaningfulWeaves,
  getFriendContext,
  MeaningfulWeave,
  FriendJournalContext,
  generateJournalPrompts,
  JournalPrompt,
  PromptContext,
} from '@/modules/journal';

// ============================================================================
// TYPES
// ============================================================================

type Step = 'context' | 'prompt' | 'write';

interface GuidedReflectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (entry: SavedEntry) => void;
  // Pre-filled from QuickCapture or WeaveLogger
  prefilledText?: string;
  prefilledFriendIds?: string[];
  prefilledWeaveId?: string;
}

interface SavedEntry {
  id: string;
  content: string;
  friendIds: string[];
  promptUsed?: string;
}

type ContextSelection =
  | { type: 'weave'; weave: MeaningfulWeave }
  | { type: 'friend'; friendContext: FriendJournalContext }
  | { type: 'general' };

// ============================================================================
// COMPONENT
// ============================================================================

export function GuidedReflectionModal({
  visible,
  onClose,
  onSave,
  prefilledText,
  prefilledFriendIds,
  prefilledWeaveId,
}: GuidedReflectionModalProps) {
  const { colors } = useTheme();

  // Navigation
  const [step, setStep] = useState<Step>('context');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  // Data
  const [meaningfulWeaves, setMeaningfulWeaves] = useState<MeaningfulWeave[]>([]);
  const [friends, setFriends] = useState<FriendModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedContext, setSelectedContext] = useState<ContextSelection | null>(null);
  const [prompts, setPrompts] = useState<JournalPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<JournalPrompt | null>(null);

  // Writing state
  const [text, setText] = useState(prefilledText || '');
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(
    new Set(prefilledFriendIds || [])
  );
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [saving, setSaving] = useState(false);

  // Refs
  const textInputRef = useRef<TextInput>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  // Handle prefilled weave
  useEffect(() => {
    if (prefilledWeaveId && meaningfulWeaves.length > 0) {
      const weave = meaningfulWeaves.find(w => w.interaction.id === prefilledWeaveId);
      if (weave) {
        // Skip context step, go straight to prompt
        handleSelectWeave(weave);
      }
    }
  }, [prefilledWeaveId, meaningfulWeaves]);

  // Handle prefilled text (from QuickCapture expand)
  useEffect(() => {
    if (prefilledText) {
      setText(prefilledText);
    }
  }, [prefilledText]);

  // Handle prefilled friends (from Friend Profile)
  useEffect(() => {
    if (prefilledFriendIds && prefilledFriendIds.length > 0 && friends.length > 0) {
      // If we have a single friend, try to set up the friend context
      if (prefilledFriendIds.length === 1) {
        const friendId = prefilledFriendIds[0];
        const friend = friends.find(f => f.id === friendId);
        if (friend) {
          handleSelectFriend(friend);
        }
      } else {
        // Multiple friends - just pre-select them for tagging
        setSelectedFriendIds(new Set(prefilledFriendIds));
      }
    }
  }, [prefilledFriendIds, friends]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [weaves, allFriends] = await Promise.all([
        getRecentMeaningfulWeaves(5, 72),  // Last 72 hours
        database
          .get<FriendModel>('friends')
          .query(Q.where('is_dormant', false), Q.sortBy('name', Q.asc))
          .fetch(),
      ]);

      setMeaningfulWeaves(weaves);
      setFriends(allFriends);
    } catch (error) {
      console.error('[GuidedReflection] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // CONTEXT SELECTION HANDLERS
  // ============================================================================

  const handleSelectWeave = useCallback(async (weave: MeaningfulWeave) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const context: ContextSelection = { type: 'weave', weave };
    setSelectedContext(context);

    // Generate prompts for this context
    const promptContext: PromptContext = { type: 'weave', weave };
    const generatedPrompts = generateJournalPrompts(promptContext);
    setPrompts(generatedPrompts);
    setSelectedPrompt(generatedPrompts[0] || null);

    // Pre-select friends from weave
    setSelectedFriendIds(new Set(weave.friends.map(f => f.id)));

    // Pre-fill text with weave notes if we don't have prefilled text
    if (!prefilledText && weave.interaction.note) {
      setText(weave.interaction.note + '\n\n');
    }

    // Go to prompt step
    setDirection('forward');
    setStep('prompt');
  }, [prefilledText]);

  const handleSelectFriend = useCallback(async (friend: FriendModel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Get friend context
    const friendContext = await getFriendContext(friend.id);
    if (!friendContext) return;

    const context: ContextSelection = { type: 'friend', friendContext };
    setSelectedContext(context);

    // Generate prompts
    const promptContext: PromptContext = { type: 'friend', friendContext };
    const generatedPrompts = generateJournalPrompts(promptContext);
    setPrompts(generatedPrompts);
    setSelectedPrompt(generatedPrompts[0] || null);

    // Pre-select this friend
    setSelectedFriendIds(new Set([friend.id]));

    // Go to prompt step
    setDirection('forward');
    setStep('prompt');
  }, []);

  const handleSelectGeneral = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const context: ContextSelection = { type: 'general' };
    setSelectedContext(context);

    // Generate general prompts
    const promptContext: PromptContext = { type: 'general' };
    const generatedPrompts = generateJournalPrompts(promptContext);
    setPrompts(generatedPrompts);
    setSelectedPrompt(generatedPrompts[0] || null);

    // Go to prompt step
    setDirection('forward');
    setStep('prompt');
  }, []);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection('back');

    if (step === 'write') {
      setStep('prompt');
    } else if (step === 'prompt') {
      setStep('context');
      setSelectedContext(null);
      setPrompts([]);
      setSelectedPrompt(null);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection('forward');

    if (step === 'prompt') {
      setStep('write');
      // Focus text input after transition
      setTimeout(() => textInputRef.current?.focus(), 300);
    }
  };

  const handleSkipPrompt = () => {
    setSelectedPrompt(null);
    handleContinue();
  };

  // ============================================================================
  // SAVE HANDLER
  // ============================================================================

  const handleSave = async () => {
    if (!text.trim()) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const savedEntry = await database.write(async () => {
        const newEntry = await database.get<JournalEntry>('journal_entries').create((entry) => {
          entry.content = text.trim();
          entry.entryDate = Date.now();
          // entry.friendTags = JSON.stringify(Array.from(selectedFriendIds)); // Removed as property does not exist
          entry.title = generateTitle(text, selectedPrompt);
          entry.isDraft = false;

          // Store prompt context for future reference
          if (selectedPrompt) {
            entry.promptUsed = selectedPrompt.question;
          }

          // Link to weave if we have one
          if (selectedContext?.type === 'weave') {
            entry.linkedWeaveId = selectedContext.weave.interaction.id;
          }
        });

        // Create friend links
        if (newEntry && selectedFriendIds.size > 0) {
          const friendsCollection = database.get<JournalEntryFriend>('journal_entry_friends');
          for (const friendId of Array.from(selectedFriendIds)) {
            await friendsCollection.create(link => {
              link.journalEntryId = newEntry.id;
              link.friendId = friendId;
            });
          }
        }

        return newEntry;
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (savedEntry) {
        onSave({
          id: savedEntry.id,
          content: savedEntry.content,
          friendIds: Array.from(selectedFriendIds),
          promptUsed: selectedPrompt?.question,
        });
      }

      // Reset and close
      resetState();
      onClose();
    } catch (error) {
      console.error('[GuidedReflection] Error saving:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setStep('context');
    setSelectedContext(null);
    setPrompts([]);
    setSelectedPrompt(null);
    setText('');
    setSelectedFriendIds(new Set());
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const generateTitle = (content: string, prompt: JournalPrompt | null): string => {
    // Try to extract a meaningful title from content
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 50) {
      return firstLine;
    }

    // Fall back to prompt-based title
    if (prompt?.relatedFriendName) {
      return `Reflection on ${prompt.relatedFriendName}`;
    }

    // Default
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short'
    });
    return `Reflection · ${date}`;
  };

  const formatTimeAgo = (date: Date): string => {
    const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // ============================================================================
  // STEP RENDERS
  // ============================================================================

  const renderContextStep = () => (
    <Animated.View
      key="context"
      entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
      exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
      className="flex-1"
    >
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <Text
          className="text-xl mb-6 mt-4"
          style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
        >
          What's on your mind?
        </Text>

        {/* Recent Meaningful Weaves */}
        {meaningfulWeaves.length > 0 && (
          <View className="mb-6">
            <Text
              className="text-xs uppercase tracking-wide mb-3"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
            >
              Recent Moments
            </Text>

            {meaningfulWeaves.map((weave) => (
              <TouchableOpacity
                key={weave.interaction.id}
                onPress={() => handleSelectWeave(weave)}
                className="mb-3 p-4 rounded-2xl"
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Coffee size={16} color={colors.primary} />
                  <Text
                    className="text-sm flex-1"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {weave.interaction.activity || weave.interaction.interactionCategory || 'Connection'}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {formatTimeAgo(new Date(weave.interaction.interactionDate))}
                  </Text>
                </View>

                {weave.friends.length > 0 && (
                  <Text
                    className="text-base mb-1"
                    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                  >
                    {weave.friends.map(f => f.name).join(' & ')}
                  </Text>
                )}

                {weave.interaction.note && (
                  <Text
                    className="text-sm italic"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                    numberOfLines={2}
                  >
                    "{weave.interaction.note}"
                  </Text>
                )}

                <View className="flex-row items-center gap-1 mt-2">
                  {weave.meaningfulnessReasons.slice(0, 2).map((reason, i) => (
                    <View
                      key={i}
                      className="px-2 py-1 rounded-full"
                      style={{ backgroundColor: colors.primary + '15' }}
                    >
                      <Text
                        className="text-xs"
                        style={{ color: colors.primary, fontFamily: 'Inter_400Regular' }}
                      >
                        {reason}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Friends */}
        <View className="mb-6">
          <Text
            className="text-xs uppercase tracking-wide mb-3"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            A Friendship
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
            <View className="flex-row gap-3">
              {friends.slice(0, 10).map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  onPress={() => handleSelectFriend(friend)}
                  className="items-center"
                  activeOpacity={0.7}
                >
                  <View
                    className="w-14 h-14 rounded-full items-center justify-center mb-1.5"
                    style={{ backgroundColor: colors.muted }}
                  >
                    <Text
                      className="text-lg"
                      style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                    >
                      {friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    className="text-xs text-center"
                    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                    numberOfLines={1}
                  >
                    {friend.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* General Reflection */}
        <View className="mb-8">
          <Text
            className="text-xs uppercase tracking-wide mb-3"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            Something Else
          </Text>

          <TouchableOpacity
            onPress={handleSelectGeneral}
            className="p-4 rounded-2xl flex-row items-center gap-3"
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            activeOpacity={0.7}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary + '15' }}
            >
              <MessageCircle size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text
                className="text-base"
                style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
              >
                General reflection
              </Text>
              <Text
                className="text-sm"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Write freely without a specific focus
              </Text>
            </View>
            <ChevronRight size={20} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );

  const renderPromptStep = () => (
    <Animated.View
      key="prompt"
      entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
      exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
      className="flex-1"
    >
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Context Card */}
        {selectedContext && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} className="mt-4 mb-6">
            {selectedContext.type === 'weave' && (
              <View
                className="p-4 rounded-2xl"
                style={{ backgroundColor: colors.muted }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Clock size={14} color={colors['muted-foreground']} />
                  <Text
                    className="text-xs"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {formatTimeAgo(new Date(selectedContext.weave.interaction.interactionDate))}
                  </Text>
                </View>
                <Text
                  className="text-sm"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  {selectedContext.weave.interaction.activity || 'Connection'} with{' '}
                  {selectedContext.weave.friends.map(f => f.name).join(' & ')}
                </Text>
                {selectedContext.weave.interaction.note && (
                  <Text
                    className="text-sm italic mt-1"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    "{selectedContext.weave.interaction.note}"
                  </Text>
                )}
              </View>
            )}

            {selectedContext.type === 'friend' && (
              <View
                className="p-4 rounded-2xl"
                style={{ backgroundColor: colors.muted }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.card }}
                  >
                    <Text
                      className="text-lg"
                      style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                    >
                      {selectedContext.friendContext.friend.name.charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-base"
                      style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                    >
                      {selectedContext.friendContext.friend.name}
                    </Text>
                    <Text
                      className="text-sm"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                    >
                      {selectedContext.friendContext.friendshipDuration} · {selectedContext.friendContext.totalWeaves} weaves
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Prompts */}
        <Text
          className="text-xs uppercase tracking-wide mb-4"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
        >
          Choose a prompt
        </Text>

        {prompts.map((prompt, index) => {
          const isSelected = selectedPrompt?.id === prompt.id;

          return (
            <Animated.View
              key={prompt.id}
              entering={FadeInDown.delay(150 + index * 50).duration(300)}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedPrompt(prompt);
                }}
                className="mb-3 p-4 rounded-2xl"
                style={{
                  backgroundColor: isSelected ? colors.primary + '15' : colors.card,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start gap-3">
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: isSelected ? colors.primary : colors.muted,
                    }}
                  >
                    {isSelected && (
                      <Text style={{ color: colors['primary-foreground'], fontSize: 12 }}>✓</Text>
                    )}
                  </View>
                  <Text
                    className="text-base flex-1 leading-6"
                    style={{
                      color: isSelected ? colors.primary : colors.foreground,
                      fontFamily: 'Lora_500Medium',
                    }}
                  >
                    {prompt.question}
                  </Text>
                </View>

                {prompt.suggestedStarters && isSelected && (
                  <View className="mt-3 ml-9">
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                    >
                      Start with:
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {prompt.suggestedStarters.slice(0, 2).map((starter, i) => (
                        <View
                          key={i}
                          className="px-2.5 py-1.5 rounded-lg"
                          style={{ backgroundColor: colors.muted }}
                        >
                          <Text
                            className="text-xs"
                            style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                          >
                            {starter}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Skip option */}
        <TouchableOpacity
          onPress={handleSkipPrompt}
          className="mt-2 mb-8 py-3 items-center"
          activeOpacity={0.7}
        >
          <Text
            className="text-sm"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
          >
            Or just start writing →
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Continue Button */}
      <View className="px-5 pb-6">
        <TouchableOpacity
          onPress={handleContinue}
          className="py-4 rounded-2xl items-center flex-row justify-center gap-2"
          style={{ backgroundColor: colors.primary }}
          activeOpacity={0.8}
        >
          <Text
            className="text-base"
            style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            {selectedPrompt ? 'Use this prompt' : 'Continue'}
          </Text>
          <ChevronRight size={18} color={colors['primary-foreground']} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderWriteStep = () => (
    <Animated.View
      key="write"
      entering={SlideInRight.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={100}
      >
        <View className="flex-1 flex-row">
          {/* Main Writing Area */}
          <View className="flex-1 px-5">
            {/* Prompt Display */}
            {selectedPrompt && (
              <Animated.View entering={FadeInDown.duration(300)} className="mt-4 mb-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Sparkles size={14} color={colors.primary} />
                  <Text
                    className="text-xs"
                    style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                  >
                    Your prompt
                  </Text>
                </View>
                <Text
                  className="text-lg leading-7"
                  style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
                >
                  {selectedPrompt.question}
                </Text>
              </Animated.View>
            )}

            {/* Text Input */}
            <TextInput
              ref={textInputRef}
              value={text}
              onChangeText={setText}
              placeholder="Start writing..."
              placeholderTextColor={colors['muted-foreground']}
              multiline
              textAlignVertical="top"
              className="flex-1 text-base"
              style={{
                color: colors.foreground,
                fontFamily: 'Inter_400Regular',
                paddingTop: 0,
              }}
            />

            {/* Friend Tags */}
            {selectedFriendIds.size > 0 && (
              <View className="flex-row flex-wrap gap-2 pb-4">
                {Array.from(selectedFriendIds).map((id) => {
                  const friend = friends.find(f => f.id === id);
                  if (!friend) return null;

                  return (
                    <View
                      key={id}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: colors.primary + '15' }}
                    >
                      <User size={12} color={colors.primary} />
                      <Text
                        className="text-xs"
                        style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                      >
                        {friend.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Context Panel (collapsible) */}
          {showContextPanel && selectedContext?.type === 'friend' && (
            <Animated.View
              entering={SlideInRight.duration(200)}
              exiting={SlideOutRight.duration(200)}
              className="w-64 border-l"
              style={{ borderColor: colors.border, backgroundColor: colors.muted + '50' }}
            >
              <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                <Text
                  className="text-xs uppercase tracking-wide mb-3"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
                >
                  Context
                </Text>

                {/* Recent weaves with this friend */}
                {selectedContext.friendContext.recentWeaves.length > 0 && (
                  <View className="mb-4">
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                    >
                      Recent with {selectedContext.friendContext.friend.name}:
                    </Text>
                    {selectedContext.friendContext.recentWeaves.slice(0, 3).map((weave, i) => (
                      <View key={weave.id} className="mb-2">
                        <Text
                          className="text-xs"
                          style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                        >
                          • {weave.activity}
                        </Text>
                        {weave.notes && (
                          <Text
                            className="text-xs italic ml-2"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                            numberOfLines={1}
                          >
                            {weave.notes}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Previous entries */}
                {selectedContext.friendContext.recentEntries.length > 0 && (
                  <View>
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                    >
                      Previous entries:
                    </Text>
                    {selectedContext.friendContext.recentEntries.map((entry) => (
                      <TouchableOpacity
                        key={entry.id}
                        className="mb-2 p-2 rounded-lg"
                        style={{ backgroundColor: colors.card }}
                      >
                        <Text
                          className="text-xs"
                          style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                        >
                          {entry.title}
                        </Text>
                        <Text
                          className="text-xs italic"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          numberOfLines={2}
                        >
                          {entry.preview}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Themes */}
                {selectedContext.friendContext.detectedThemes.length > 0 && (
                  <View className="mt-4">
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                    >
                      Common themes:
                    </Text>
                    <View className="flex-row flex-wrap gap-1">
                      {selectedContext.friendContext.detectedThemes.map((theme, i) => (
                        <View
                          key={i}
                          className="px-2 py-1 rounded-full"
                          style={{ backgroundColor: colors.primary + '15' }}
                        >
                          <Text
                            className="text-xs"
                            style={{ color: colors.primary, fontFamily: 'Inter_400Regular' }}
                          >
                            {theme}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </View>

        {/* Bottom Bar */}
        <View
          className="flex-row items-center justify-between px-5 py-4 border-t"
          style={{ borderColor: colors.border }}
        >
          {/* Toggle Context Panel (only show on tablet/larger screens or if friend context) */}
          {selectedContext?.type === 'friend' && (
            <TouchableOpacity
              onPress={() => setShowContextPanel(!showContextPanel)}
              className="flex-row items-center gap-2"
            >
              {showContextPanel ? (
                <PanelRightClose size={20} color={colors['muted-foreground']} />
              ) : (
                <PanelRightOpen size={20} color={colors['muted-foreground']} />
              )}
              <Text
                className="text-sm"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                {showContextPanel ? 'Hide context' : 'Show context'}
              </Text>
            </TouchableOpacity>
          )}

          <View className="flex-1" />

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={!text.trim() || saving}
            className="px-6 py-3 rounded-xl"
            style={{
              backgroundColor: text.trim() ? colors.primary : colors.muted,
              opacity: saving ? 0.7 : 1,
            }}
            activeOpacity={0.8}
          >
            <Text
              className="text-base"
              style={{
                color: text.trim() ? colors['primary-foreground'] : colors['muted-foreground'],
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: colors.border }}
        >
          {/* Back Button */}
          {step !== 'context' ? (
            <TouchableOpacity
              onPress={handleBack}
              className="flex-row items-center gap-1"
            >
              <ChevronLeft size={20} color={colors.foreground} />
              <Text
                className="text-base"
                style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
              >
                Back
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="w-16" />
          )}

          {/* Title */}
          <Text
            className="text-base"
            style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
          >
            {step === 'context' && 'New Reflection'}
            {step === 'prompt' && 'Choose a Prompt'}
            {step === 'write' && 'Write'}
          </Text>

          {/* Close Button */}
          <TouchableOpacity
            onPress={handleClose}
            className="p-2 -mr-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Progress Dots */}
        <View className="flex-row justify-center gap-2 py-3">
          {['context', 'prompt', 'write'].map((s, i) => (
            <View
              key={s}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  s === step
                    ? colors.primary
                    : ['context', 'prompt', 'write'].indexOf(step) > i
                      ? colors.primary + '50'
                      : colors.border,
              }}
            />
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              className="text-sm mt-4"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              Loading...
            </Text>
          </View>
        ) : (
          <>
            {step === 'context' && renderContextStep()}
            {step === 'prompt' && renderPromptStep()}
            {step === 'write' && renderWriteStep()}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default GuidedReflectionModal;
