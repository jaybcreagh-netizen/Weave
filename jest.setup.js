// jest.setup.js
/* eslint-disable @typescript-eslint/no-require-imports */

// This global variable is required by React Native's native module system.
// In a Jest environment, it's not set automatically, leading to the
// "__fbBatchedBridgeConfig is not set" error. Defining it here as an empty
// config allows the test suite to run without crashing.
global.__fbBatchedBridgeConfig = {
  remoteModuleConfig: [],
  localModulesConfig: [],
};

// This mock is necessary to prevent errors in the Jest environment when
// modules expect native code to be available (e.g., for getting a bundle URL).
jest.mock('react-native/Libraries/NativeModules/specs/NativeSourceCode', () => ({
  getConstants: () => ({
    scriptURL: 'jest.bundle',
  }),
}));


// This mock is necessary to prevent errors when WatermelonDB's native
// SQLite adapter is initialized. The "NativeModules.WMDatabaseBridge is not defined!"
// error occurs because the native module is not available in a Node.js test environment.
jest.mock('react-native/Libraries/BatchedBridge/NativeModules', () => ({
  ...jest.requireActual('react-native/Libraries/BatchedBridge/NativeModules'),
  WMDatabaseBridge: {
    initialize: jest.fn(),
    setUpWithSchema: jest.fn(),
    setUpWithMigrations: jest.fn(),
    find: jest.fn(),
    query: jest.fn(),
    count: jest.fn(),
    batch: jest.fn(),
    getDeletedRecords: jest.fn(),
    destroyDeletedRecords: jest.fn(),
    unsafeResetDatabase: jest.fn(),
    getLocal: jest.fn(),
    setLocal: jest.fn(),
    removeLocal: jest.fn(),
  },
}));

// Mock Sentry to prevent native module errors
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  wrap: (fn) => fn,
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  ReactNativeTracing: jest.fn(),
  ReactNavigationInstrumentation: jest.fn(),
}));

// Mock the migrations module
jest.mock('@/db/migrations', () => {
  const { schemaMigrations } = require('@nozbe/watermelondb/Schema/migrations');
  return {
    migrations: schemaMigrations({
      migrations: [],
    }),
  };
});




