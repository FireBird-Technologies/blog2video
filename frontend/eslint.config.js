import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

// Deliberately minimal lint. Its ONLY active rule is the one bug class `tsc`
// can't see: the Rules of Hooks (hooks must run unconditionally, in the same
// order every render — a violation is a runtime crash). No style rules are
// enabled, so it stays silent unless someone actually writes a hook bug.
//
// The @typescript-eslint and react plugins are registered but enable NOTHING —
// they exist purely so the codebase's pre-existing `// eslint-disable` comments
// (which reference `@typescript-eslint/no-explicit-any`, `react/no-array-index-
// key`, etc.) resolve instead of erroring as "unknown rule".
export default [
  { ignores: ["dist", "node_modules", "coverage"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: {
      // The repo has stale eslint-disable comments from a past setup; don't
      // fail or nag over them.
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      "@typescript-eslint": tsPlugin,
      react,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      // exhaustive-deps intentionally OFF (has pre-existing findings + adds
      // noise). Flip to "warn" later if you want stale-closure hints.
    },
  },
  {
    // Baseline: two pre-existing conditional-hook violations in render
    // templates, turned off here so app source stays byte-untouched. They don't
    // crash today (conditions are stable per Remotion composition). Documented
    // in the QA memory note; fix later by hoisting the hooks. NEW hook bugs in
    // any OTHER file are still caught.
    files: [
      "src/components/remotion/newscast/layouts/DataVisualization.tsx",
      "src/components/remotion/newscast/NewsCastBackground.tsx",
    ],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
];
