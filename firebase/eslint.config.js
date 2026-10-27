// Vérification du code JavaScript des tests des règles (ESLint) : https://eslint.org/docs/latest/use/configure/
// Lancement : npm run lint. La mise en forme, elle, est faite par Prettier (npm run format).

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

export default defineConfig([
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "all", ignoreRestSiblings: true },
      ],
      "prefer-const": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
]);
