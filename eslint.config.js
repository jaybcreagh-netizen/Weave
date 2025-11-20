const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../modules/*"],
              message: "Import from module index.ts only (e.g., @/modules/intelligence)",
            },
            {
              group: ["../../*"],
              message: "Use absolute imports (@/) instead of relative imports for cross-module dependencies",
            },
          ],
        },
      ],
      // Disable some annoying rules for now to focus on module boundaries
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
);
