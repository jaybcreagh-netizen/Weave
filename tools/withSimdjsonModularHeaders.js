const { withPodfile } = require('@expo/config-plugins');

const withSimdjsonModularHeaders = (config) => {
  return withPodfile(config, (config) => {
    const podfileContent = config.modResults.contents;
    // Check if the specific pod configuration already exists
    if (!podfileContent.includes("pod 'simdjson', :modular_headers => true")) {
      // Add the pod configuration to the target block
      // We look for the "use_expo_modules!" line or "use_react_native!" line to inject before
      const anchor = /use_expo_modules!/;
      if (anchor.test(podfileContent)) {
          config.modResults.contents = podfileContent.replace(
              anchor,
              `pod 'simdjson', :modular_headers => true\n  use_expo_modules!`
          );
      } else {
          // Fallback if use_expo_modules! is not found (unlikely in managed workflow)
          config.modResults.contents += `\npod 'simdjson', :modular_headers => true\n`;
      }
    }
    return config;
  });
};

module.exports = withSimdjsonModularHeaders;
