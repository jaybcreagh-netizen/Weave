module.exports = {
  BackgroundFetchResult: {
    NoData: 'NoData',
    NewData: 'NewData',
    Failed: 'Failed',
  },
  BackgroundFetchStatus: {
    Denied: 'Denied',
    Restricted: 'Restricted',
    Available: 'Available',
  },
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
  getStatusAsync: jest.fn(async () => 'Available'),
};
