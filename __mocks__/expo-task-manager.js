const definedTasks = new Map();

module.exports = {
  defineTask: jest.fn((taskName, taskFn) => {
    definedTasks.set(taskName, taskFn);
  }),
  isTaskRegisteredAsync: jest.fn(async () => false),
  unregisterTaskAsync: jest.fn(async () => undefined),
  registerTaskAsync: jest.fn(async () => undefined),
  getTaskOptionsAsync: jest.fn(async () => null),
  isTaskDefined: jest.fn((taskName) => definedTasks.has(taskName)),
};
