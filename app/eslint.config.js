// Vérification du code JavaScript (ESLint) : https://eslint.org/docs/latest/use/configure/
// Lancement : npm run lint. La mise en forme, elle, est faite par Prettier (npm run format).

import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import playwright from "eslint-plugin-playwright";
import globals from "globals";

export default defineConfig([
  globalIgnores(["dist/", "dist-emulateurs/", "test-results/", "playwright-report/"]),

  // L'appli, dans le navigateur. __VERSION__ est remplacé par Vite à la construction.
  {
    files: ["src/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.browser, __VERSION__: "readonly" } },
  },

  // Configurations et tests de logique : lancés par Node.js.
  {
    files: ["*.config.js", "tests/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // Scénarios réels : les règles de Playwright repèrent, entre autres, un « await » oublié.
  {
    files: ["e2e/**/*.js"],
    extends: [js.configs.recommended, playwright.configs["flat/recommended"]],
    // Node.js pour les scénarios, navigateur pour le code passé à page.evaluate().
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Les captures d'écran : un script de documentation, lancé à la demande, avec une partie propre
  // au mode clair. Ce ne sont pas des tests : les règles sur les conditions ne s'y appliquent pas.
  {
    files: ["e2e/captures.spec.js"],
    rules: {
      "playwright/no-conditional-in-test": "off",
      "playwright/no-conditional-expect": "off",
      "playwright/no-skipped-test": "off",
    },
  },

  // Pour tout le code : signaler les variables inutilisées, sauf celles qui commencent par « _ ».
  {
    files: ["**/*.js"],
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
