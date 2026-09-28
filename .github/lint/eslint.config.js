// Lint for every workspace. Lives under .github/ on purpose: .github/ is a
// protected path, so an agent cannot weaken the rules in its own pull request.
// Each rule backs a convention in .github/conventions/, and its message says how
// to fix. Run with `npm run lint` (check) or `npm run format` (fix what can be).
import js from "@eslint/js";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { noBarrelFiles } from "./rules/no-barrel-files.js";
import { noRawColors } from "./rules/no-raw-colors.js";

const local = { rules: { "no-barrel-files": noBarrelFiles, "no-raw-colors": noRawColors } };

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/dist/**", "**/migrations/**", "**/test-results/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { "import-x/resolver-next": [createTypeScriptImportResolver({ project: ["apps/*/tsconfig.json", "packages/*/tsconfig.json"], noWarnOnMultipleProjects: true })] },
    // No `eslint-disable` comments: an agent that meets a rule it dislikes must
    // fix the code, not silence the rule. `--max-warnings 0` turns the report
    // of an ignored comment into a failure.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    plugins: { local },
    rules: {
      eqeqeq: "error",
      "prefer-const": "error",
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      // chain/structure.md, Imports
      "import-x/no-default-export": "error",
      "import-x/no-cycle": "error",
      "import-x/no-relative-packages": "error",
      "import-x/no-extraneous-dependencies": ["error", { packageDir: [".", "apps/web", "apps/api", "packages/shared"] }],
      "local/no-barrel-files": "error",
    },
  },
  // Framework entry and config files that must default-export. Storybook's
  // stories (Component Story Format) and its config are read by their default
  // export too.
  {
    files: [
      "**/vite.config.ts", "**/vitest.config.ts", "**/playwright.config.ts", "**/drizzle.config.ts",
      "**/*.stories.tsx", "**/.storybook/*.ts",
    ],
    rules: { "import-x/no-default-export": "off" },
  },
  // Web: React, accessibility, one API client, colours through tokens (web.md).
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "jsx-a11y-x": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "local/no-raw-colors": "error",
      "no-restricted-globals": ["error", { name: "fetch", message: "Call the API through src/lib/api-client.ts (web.md, Data comes through one client)." }],
    },
  },
  { files: ["apps/web/src/lib/api-client.ts"], rules: { "no-restricted-globals": "off" } },
  // API: routes → service → repository, one way only (api.md).
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "import-x/no-restricted-paths": ["error", { zones: [
        { target: "apps/api/src/features/*/routes.ts", from: "apps/api/src/features/*/repository.ts", message: "Routes call the service, never the repository (api.md, Three layers)." },
        { target: "apps/api/src/features/*/routes.ts", from: "apps/api/src/db", message: "Routes never touch the database (api.md, Three layers)." },
        { target: "apps/api/src/features/*/repository.ts", from: "apps/api/src/features/*/routes.ts", message: "Repositories know nothing about HTTP (api.md, Three layers)." },
        { target: "apps/api/src/features/*/service.ts", from: "apps/api/src/features/*/routes.ts", message: "Services know nothing about HTTP (api.md, Three layers)." },
      ] }],
    },
  },
);
