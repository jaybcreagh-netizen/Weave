const TEST_UUID = '00000000-0000-4000-8000-000000000000';

module.exports = {
  v1: jest.fn(() => TEST_UUID),
  v3: jest.fn(() => TEST_UUID),
  v4: jest.fn(() => TEST_UUID),
  v5: jest.fn(() => TEST_UUID),
  validate: jest.fn(() => true),
  version: jest.fn(() => 4),
  NIL: '00000000-0000-0000-0000-000000000000',
};
