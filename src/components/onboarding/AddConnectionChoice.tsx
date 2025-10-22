
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Users, UserPlus } from 'lucide-react-native';
import { theme } from '../../theme';

interface AddConnectionChoiceProps {
  onChoice: (choice: 'contacts' | 'manual') => void;
}

export function AddConnectionChoice({ onChoice }: AddConnectionChoiceProps) {
  return (
    <Animated.View style={styles.container} entering={FadeInUp.duration(600)}>
      <Text style={styles.title}>Let's add your first connection</Text>
      <Text style={styles.subtitle}>How would you like to start?</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => onChoice('contacts')}>
          <Users size={24} color={theme.colors.primary} />
          <Text style={styles.buttonText}>Choose from Contacts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={() => onChoice('manual')}>
          <UserPlus size={24} color={theme.colors.primary} />
          <Text style={styles.buttonText}>Add Manually</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'serif',
    textAlign: 'center',
    color: theme.colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 12,
    color: theme.colors.foreground,
  },
});
