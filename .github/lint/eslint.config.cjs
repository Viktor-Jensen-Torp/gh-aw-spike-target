// @ts-check
"use strict";

/**
 * Lint rules for src/ and test/. Lives under .github/ on purpose: .github/ is a
 * protected path, so an agent cannot weaken the rules in its own pull request,
 * and the pre-push hook runs against the base branch's copy of verify.sh.
 *
 * Every rule here is a nudge the agent gets for free, before any review: when a
 * reviewer keeps flagging the same thing, it belongs here as a rule with a
 * message that says what to do (see rules/).
 *
 * Run through `npm run lint` (check) or `npm run format` (fix what can be).
 */

const js = require("@eslint/js");
const globals = require("globals");
const oneHelperPerFile = require("./rules/one-helper-per-file.cjs");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    // No `eslint-disable` comments: an agent that meets a rule it dislikes must
    // fix the code, not silence the rule. Ignored comments are reported, and
    // `--max-warnings 0` turns that report into a failure.
    linterOptions: { noInlineConfig: true },
    plugins: { local: { rules: { "one-helper-per-file": oneHelperPerFile } } },
    rules: {
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
    },
  },
  {
    files: ["src/**/*.js"],
    ignores: ["src/index.js"],
    rules: { "local/one-helper-per-file": "error" },
  },
];
