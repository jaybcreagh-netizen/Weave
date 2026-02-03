module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '@react-native-async-storage/async-storage': '<rootDir>/__mocks__/async-storage-mock.js',
    '^@react-native-google-signin/google-signin$': '<rootDir>/__mocks__/google-signin.js',
    '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.js',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system-legacy.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system-legacy.js',
    '^expo-task-manager$': '<rootDir>/__mocks__/expo-task-manager.js',
    '^expo-background-fetch$': '<rootDir>/__mocks__/expo-background-fetch.js',
    '^uuid$': '<rootDir>/__mocks__/uuid.js',
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|@sentry/react-native|native-base|react-native-svg|@nozbe/watermelondb|@nozbe/with-observables|@react-native-async-storage)",
  ],
};
