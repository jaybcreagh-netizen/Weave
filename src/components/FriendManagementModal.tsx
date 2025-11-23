import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, Trash2, Check } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useRelationshipsStore } from '@/modules/relationships';
import { calculateCurrentScore } from '@/modules/intelligence';
import type FriendModel from '../db/models/Friend';

interface FriendManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FriendManagementModal({ visible, onClose }: FriendManagementModalProps) {
  const { colors } = useTheme();
  const { friends, batchDeleteFriends } = useRelationshipsStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset selection when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
    }
  }, [visible]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (friends) {
      setSelectedIds(new Set(friends.map(f => f.id)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDelete = () => {
    if (selectedIds.size === 0) return;

    Alert.alert(
      'Delete Friends',
      `Are you sure you want to delete ${selectedIds.size} friend${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await batchDeleteFriends(Array.from(selectedIds));
              setSelectedIds(new Set());
              onClose();
            } catch (error) {
              console.error('Error deleting friends:', error);
              Alert.alert('Error', 'Failed to delete friends. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  const sortedFriends = friends ? [...friends].sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View
          style={{
            flex: 1,
            marginTop: 60,
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: colors.border
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '600', color: colors.foreground, fontFamily: 'Lora_700Bold' }}>
              Manage Friends
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>

          {/* Selection Controls */}
          <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity
              onPress={selectAll}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={deselectAll}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>Deselect All</Text>
            </TouchableOpacity>
          </View>

          {/* Friend List */}
          <ScrollView style={{ flex: 1 }}>
            {sortedFriends.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: colors['muted-foreground'], fontSize: 16, textAlign: 'center' }}>
                  No friends to manage
                </Text>
              </View>
            ) : (
              sortedFriends.map((friend) => {
                const isSelected = selectedIds.has(friend.id);
                const currentScore = calculateCurrentScore(friend);

                return (
                  <TouchableOpacity
                    key={friend.id}
                    onPress={() => toggleSelection(friend.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      {isSelected && <Check size={16} color={colors['primary-foreground']} />}
                    </View>

                    {/* Friend Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                        {friend.name}
                      </Text>
                      <Text style={{ fontSize: 14, color: colors['muted-foreground'], marginTop: 2 }}>
                        {friend.tier} • Score: {Math.round(currentScore)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer with Delete Button */}
          <View
            style={{
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <TouchableOpacity
              onPress={handleDelete}
              disabled={selectedIds.size === 0 || isDeleting}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                borderRadius: 12,
                backgroundColor: selectedIds.size > 0 ? colors.destructive : colors.muted,
                opacity: selectedIds.size === 0 || isDeleting ? 0.5 : 1,
              }}
            >
              <Trash2 size={20} color={selectedIds.size > 0 ? colors['destructive-foreground'] : colors['muted-foreground']} />
              <Text
                style={{
                  marginLeft: 8,
                  fontSize: 16,
                  fontWeight: '600',
                  color: selectedIds.size > 0 ? colors['destructive-foreground'] : colors['muted-foreground']
                }}
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Friend${selectedIds.size !== 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
