import React from 'react';
import { View } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/db';
import UserProgress from '@/db/models/UserProgress';

interface ReactiveWidgetBaseProps {
    children: (userProgress: UserProgress) => React.ReactNode;
    userProgress?: UserProgress[]; // Array because observe() returns an array for queries
}

const ReactiveWidgetBaseContent = ({ children, userProgress }: ReactiveWidgetBaseProps) => {
    // Since UserProgress is a singleton, valid data is the first item
    const progress = userProgress?.[0];

    if (!progress) {
        // Optionally return null or a loading state if data isn't ready
        return null;
    }

    return <>{children(progress)}</>;
};

// Observe the UserProgress table. Since it's a singleton, we know there's only one relevant row.
// HACK: WatermelonDB usually requires consistent queries.
// We query essentially "all" but expecting just the singleton.
const enhance = withObservables([], () => ({
    userProgress: database.get<UserProgress>('user_progress').query().observe(),
}));

export const ReactiveWidgetBase = enhance(ReactiveWidgetBaseContent);
