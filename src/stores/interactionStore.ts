import { create } from 'zustand';
import { database } from '../db';
import Interaction from '../db/models/Interaction';

export interface InteractionFormData {
  friendIds: string[];
  activity: string;
  notes?: string;
  date: Date;
  type: 'log' | 'plan';
  status: 'completed' | 'planned';
  mode: string;
}

interface InteractionStore {
  addInteraction: (data: InteractionFormData) => Promise<void>;
  deleteInteraction: (id: string) => Promise<void>;
}

export const useInteractionStore = create<InteractionStore>(() => ({
  addInteraction: async (data: InteractionFormData) => {
    await database.write(async () => {
        await database.get('interactions').create(interaction => {
            interaction.activity = data.activity;
            interaction.notes = data.notes;
            interaction.date = data.date;
            interaction.type = data.type;
            interaction.status = data.status;
            interaction.mode = data.mode;
            interaction.friendIds = data.friendIds[0];
        });
    });
  },
  deleteInteraction: async (id: string) => {
    await database.write(async () => {
        const interaction = await database.get<Interaction>('interactions').find(id);
        await interaction.destroyPermanently();
    });
  },
}));
