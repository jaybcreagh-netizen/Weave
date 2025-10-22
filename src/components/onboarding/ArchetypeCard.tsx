import { View, Text, TouchableOpacity } from 'react-native';
import { Info } from 'lucide-react-native';
import { type Archetype } from '../types';
import { ArchetypeIcon } from '../ArchetypeIcon';

interface ArchetypeCardProps {
  archetype: Archetype;
  isSelected: boolean;
  onSelect: (archetype: Archetype) => void;
  onInfoPress: (archetype: Archetype) => void;
}

export function ArchetypeCard({ archetype, isSelected, onSelect, onInfoPress }: ArchetypeCardProps) {
  const iconColor = isSelected ? '#8b5cf6' : '#4b5563';

  return (
    <TouchableOpacity
      onPress={() => onSelect(archetype)}
      className={`w-[30%] rounded-lg p-2 pb-4 justify-between items-center border-2 ${isSelected ? 'border-purple-500 bg-purple-100' : 'border-gray-300 bg-white'}`}
    >
      <TouchableOpacity onPress={() => onInfoPress(archetype)} className="absolute top-1 right-1 p-1 z-10">
        <Info size={16} color={isSelected ? '#8b5cf6' : '#6b7280'} />
      </TouchableOpacity>
      
      <View className="flex-1 justify-center items-center">
        <ArchetypeIcon archetype={archetype} size={24} color={iconColor} />
      </View>

      <Text className={`text-center font-semibold ${isSelected ? 'text-purple-800' : 'text-gray-800'}`}>
        {archetype}
      </Text>
    </TouchableOpacity>
  );
}