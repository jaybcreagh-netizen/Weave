/// <reference types="nativewind/types" />
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import type { Contact } from 'expo-contacts';
import { ChevronRight, Info } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { type Archetype, type MockContact } from '../types';
import { archetypeData } from '../../lib/constants';
import { ArchetypeCard } from './ArchetypeCard';

const ARCHETYPE_NAMES = Object.keys(archetypeData) as Archetype[];
const ARCHETYPE_DETAILS = archetypeData;

interface ArchetypeQuizProps {
  friends: (Contact | MockContact)[];
  onComplete: (assignments: Record<string, Archetype>) => void;
}

export function ArchetypeQuiz({ friends, onComplete }: ArchetypeQuizProps) {
  if (!friends || friends.length === 0) {
    return null;
  }

  const [currentFriendIndex, setCurrentFriendIndex] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, Archetype>>({});
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);
  const [showingInfo, setShowingInfo] = useState<Archetype | null>(null);

  const currentFriend = friends[currentFriendIndex];
  const progress = ((currentFriendIndex) / friends.length) * 100;

  const handleSelectArchetype = (archetype: Archetype) => {
    setSelectedArchetype(archetype);
    setShowingInfo(null); // Close info if open
  };

  const handleShowInfo = (archetype: Archetype) => {
    setShowingInfo(showingInfo === archetype ? null : archetype);
  };

  const handleConfirm = () => {
    if (!selectedArchetype || !currentFriend) return;

    const newAssignments = { ...assignments, [currentFriend.id!]: selectedArchetype };
    setAssignments(newAssignments);

    if (currentFriendIndex === friends.length - 1) {
      onComplete(newAssignments);
    } else {
      setCurrentFriendIndex(currentFriendIndex + 1);
      setSelectedArchetype(null);
      setShowingInfo(null);
    }
  };

  if (!currentFriend) return null;

  return (
    <View className="flex-1 p-4">
      {/* Progress Bar */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm text-gray-500">
            Friend {currentFriendIndex + 1} of {friends.length}
          </Text>
          <Text className="text-sm font-medium text-emerald-600">
            {Math.round(progress)}% Complete
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View 
            style={{ width: `${progress}%` }}
            className="h-full bg-emerald-500 rounded-full"
          />
        </View>
      </View>

      {/* Friend Name */}
      <Animated.View entering={FadeIn} className="items-center mb-8">
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          {currentFriend.name}
        </Text>
        <Text className="text-lg text-gray-600">
          Which archetype feels right?
        </Text>
      </Animated.View>

      {/* Archetype Grid */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap justify-center gap-3 mb-6">
          {ARCHETYPE_NAMES.map((name) => (
            <ArchetypeCard
              key={name}
              archetype={name}
              isSelected={selectedArchetype === name}
              onSelect={handleSelectArchetype}
              onInfoPress={handleShowInfo}
            />
          ))}
        </View>

        {/* Info Panel (inline, not modal) */}
        {showingInfo && (
          <Animated.View 
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6"
          >
            <View className="flex-row items-center mb-3">
              <Info size={20} color="#10b981" />
              <Text className="text-xl font-bold text-emerald-900 ml-2">
                {showingInfo}
              </Text>
            </View>
            
            <Text className="text-base text-emerald-800 mb-2 font-semibold">
              Essence
            </Text>
            <Text className="text-base text-emerald-700 mb-4 leading-relaxed">
              {ARCHETYPE_DETAILS[showingInfo].essence}
            </Text>
            
            <Text className="text-base text-emerald-800 mb-2 font-semibold">
              Connection Style
            </Text>
            <Text className="text-base text-emerald-700 leading-relaxed">
              {ARCHETYPE_DETAILS[showingInfo].connectionStyle}
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Confirm Button */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!selectedArchetype}
        className={`py-4 rounded-2xl flex-row justify-center items-center ${
          !selectedArchetype ? 'bg-gray-300' : 'bg-emerald-600'
        }`}
      >
        <Text className="text-white text-lg font-bold mr-2">
          {currentFriendIndex === friends.length - 1 ? 'Finish' : 'Next Friend'}
        </Text>
        <ChevronRight color="white" size={24} />
      </TouchableOpacity>
    </View>
  );
}