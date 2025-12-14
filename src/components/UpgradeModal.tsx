/**
 * Upgrade Modal Component
 * Shows subscription tiers and handles upgrades
 * This is a template - integrate with Stripe/RevenueCat for actual payments
 */

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { logger } from '@/shared/services/logger.service';
import { Check, X, Crown, Star } from 'lucide-react-native';
import { TIER_LIMITS, FEATURE_DESCRIPTIONS } from '@/modules/auth';
import { useTierInfo } from '@/modules/auth';
import { StandardBottomSheet } from '@/shared/ui/Sheet';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  highlightFeature?: string;
}

export function UpgradeModal({ visible, onClose, highlightFeature }: UpgradeModalProps) {
  const { tier: currentTier, display } = useTierInfo();
  const [selectedTier, setSelectedTier] = useState<'plus' | 'premium'>('plus');

  const handleUpgrade = async () => {
    // TODO: Integrate with Stripe/RevenueCat
    logger.debug('UpgradeModal', 'Upgrading to:', selectedTier);
    // Implement restore logic
    // In production, this would:
    // 1. Open payment sheet (Stripe/RevenueCat)
    // 2. Process payment
    // 3. Update subscription in Supabase
    // 4. Refresh user subscription state

    onClose();
  };

  const features = [
    {
      id: 'maxFriends',
      name: 'Friend Limit',
      free: '20 friends',
      plus: '100 friends',
      premium: 'Unlimited',
    },
    {
      id: 'maxWeavesPerMonth',
      name: 'Monthly Weaves',
      free: '50 weaves',
      plus: '200 weaves',
      premium: 'Unlimited',
    },
    {
      id: 'sync',
      name: 'Cloud Sync',
      free: '2 devices',
      plus: '5 devices',
      premium: 'Unlimited devices',
    },
    {
      id: 'analytics',
      name: 'Advanced Analytics',
      free: false,
      plus: true,
      premium: true,
    },
    {
      id: 'journal',
      name: 'Personal Journal',
      free: false,
      plus: true,
      premium: true,
    },
    {
      id: 'export',
      name: 'Data Export',
      free: false,
      plus: true,
      premium: true,
    },
    {
      id: 'ai',
      name: 'AI Insights',
      free: false,
      plus: false,
      premium: true,
    },
    {
      id: 'support',
      name: 'Priority Support',
      free: false,
      plus: false,
      premium: true,
    },
  ];

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      height="full"
      title="Upgrade Weave"
    >
      <ScrollView className="flex-1">
        {/* Current Tier Badge */}
        <View className="px-6 py-4 bg-gray-50">
          <Text className="text-sm text-gray-600">Current Plan</Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-xl mr-2">{display.icon}</Text>
            <Text className="text-lg font-semibold">{display.name}</Text>
          </View>
        </View>

        {/* Tier Selection */}
        <View className="px-6 py-6">
          <Text className="text-lg font-semibold mb-4">Choose Your Plan</Text>

          {/* Plus Tier Card */}
          <TouchableOpacity
            onPress={() => setSelectedTier('plus')}
            className={`border-2 rounded-xl p-4 mb-4 ${selectedTier === 'plus' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
              }`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Star size={20} color="#8B5CF6" fill="#8B5CF6" />
                <Text className="text-xl font-bold ml-2">Plus</Text>
              </View>
              <Text className="text-2xl font-bold">$4.99<Text className="text-sm text-gray-500">/mo</Text></Text>
            </View>
            <Text className="text-gray-600">Perfect for power users</Text>

            <View className="mt-3 space-y-1">
              <Text className="text-sm">• 100 friends</Text>
              <Text className="text-sm">• 200 weaves/month</Text>
              <Text className="text-sm">• Advanced analytics</Text>
              <Text className="text-sm">• Journal access</Text>
            </View>
          </TouchableOpacity>

          {/* Premium Tier Card */}
          <TouchableOpacity
            onPress={() => setSelectedTier('premium')}
            className={`border-2 rounded-xl p-4 mb-4 ${selectedTier === 'premium' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
              }`}
          >
            <View className="absolute top-2 right-2 bg-amber-500 px-2 py-1 rounded">
              <Text className="text-xs text-white font-semibold">BEST VALUE</Text>
            </View>

            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Crown size={20} color="#F59E0B" fill="#F59E0B" />
                <Text className="text-xl font-bold ml-2">Premium</Text>
              </View>
              <Text className="text-2xl font-bold">$9.99<Text className="text-sm text-gray-500">/mo</Text></Text>
            </View>
            <Text className="text-gray-600">Everything you need</Text>

            <View className="mt-3 space-y-1">
              <Text className="text-sm">• Unlimited friends</Text>
              <Text className="text-sm">• Unlimited weaves</Text>
              <Text className="text-sm">• AI-powered insights</Text>
              <Text className="text-sm">• Priority support</Text>
              <Text className="text-sm">• All Plus features</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Feature Comparison Table */}
        <View className="px-6 pb-6">
          <Text className="text-lg font-semibold mb-4">Full Comparison</Text>

          <View className="bg-gray-50 rounded-xl overflow-hidden">
            {/* Header Row */}
            <View className="flex-row border-b border-gray-200 bg-white">
              <View className="flex-1 p-3">
                <Text className="text-xs font-semibold text-gray-500">FEATURE</Text>
              </View>
              <View className="w-20 p-3 items-center">
                <Text className="text-xs font-semibold text-gray-500">FREE</Text>
              </View>
              <View className="w-20 p-3 items-center bg-purple-50">
                <Text className="text-xs font-semibold text-purple-600">PLUS</Text>
              </View>
              <View className="w-20 p-3 items-center bg-amber-50">
                <Text className="text-xs font-semibold text-amber-600">PRO</Text>
              </View>
            </View>

            {/* Feature Rows */}
            {features.map((feature, index) => (
              <View
                key={feature.id}
                className={`flex-row border-b border-gray-200 ${highlightFeature === feature.id ? 'bg-yellow-50' : ''
                  }`}
              >
                <View className="flex-1 p-3">
                  <Text className="text-sm">{feature.name}</Text>
                </View>
                <View className="w-20 p-3 items-center">
                  {typeof feature.free === 'boolean' ? (
                    feature.free ? (
                      <Check size={16} color="#10B981" />
                    ) : (
                      <X size={16} color="#EF4444" />
                    )
                  ) : (
                    <Text className="text-xs text-center">{feature.free}</Text>
                  )}
                </View>
                <View className="w-20 p-3 items-center bg-purple-50">
                  {typeof feature.plus === 'boolean' ? (
                    feature.plus ? (
                      <Check size={16} color="#8B5CF6" />
                    ) : (
                      <X size={16} color="#EF4444" />
                    )
                  ) : (
                    <Text className="text-xs text-center">{feature.plus}</Text>
                  )}
                </View>
                <View className="w-20 p-3 items-center bg-amber-50">
                  {typeof feature.premium === 'boolean' ? (
                    feature.premium ? (
                      <Check size={16} color="#F59E0B" />
                    ) : (
                      <X size={16} color="#EF4444" />
                    )
                  ) : (
                    <Text className="text-xs text-center">{feature.premium}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Terms */}
        <View className="px-6 pb-6">
          <Text className="text-xs text-gray-500 text-center">
            Cancel anytime. Prices in USD. Subscriptions auto-renew.
          </Text>
        </View>
      </ScrollView>

      {/* CTA Button */}
      <View className="px-6 py-4 border-t border-gray-200 bg-white">
        <TouchableOpacity
          onPress={handleUpgrade}
          className="bg-purple-600 rounded-xl py-4 items-center"
        >
          <Text className="text-white font-semibold text-lg">
            Upgrade to {selectedTier === 'plus' ? 'Plus' : 'Premium'}
          </Text>
          <Text className="text-purple-200 text-sm mt-1">
            ${selectedTier === 'plus' ? '4.99' : '9.99'}/month
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} className="mt-3">
          <Text className="text-center text-gray-500">Maybe Later</Text>
        </TouchableOpacity>
      </View>
    </StandardBottomSheet>
  );
}
