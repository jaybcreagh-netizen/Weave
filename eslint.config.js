/* eslint-disable @typescript-eslint/no-require-imports */
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
              group: ["src/lib/*", "@/lib/*"],
              message: "Importing from src/lib is forbidden. Move code to modules or shared.",
            },
            {
              group: ["../../*"],
              message: "Use absolute imports (@/) instead of relative imports that go up two levels.",
            },
            {
              group: ["@/modules/*/*"],
              message: "Import from module index.ts only (e.g., import { X } from '@/modules/gamification'). Deep imports are forbidden.",
            },
          ],
        },
      ],
      // Disable some annoying rules for now to focus on module boundaries
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
);
