import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";

// eslint-config-next@16's own package wraps eslint-plugin-react in a way that
// creates a circular self-reference (plugins.react -> ... -> plugins.react),
// which crashes ESLint's legacy FlatCompat bridge with "Converting circular
// structure to JSON" regardless of ESLint version -- a real upstream bug, not
// a config mistake. Depending on @next/eslint-plugin-next directly (the
// lower-level rules package eslint-config-next itself wraps) sidesteps that
// wrapper and its circularity entirely, while keeping the same Next.js rule
// set. This is the flat-config pattern Next.js's own docs recommend when
// eslint-config-next's shareable config isn't usable directly.
//
// eslint-plugin-react-hooks is added the same standalone way, for the same
// reason: it's the actual hooks-correctness linting (rules-of-hooks,
// exhaustive-deps) that eslint-config-next would otherwise have pulled in as
// part of its own bundled react plugin, and it has no circular-reference
// problem of its own, so it doesn't need FlatCompat at all.
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: { "react-hooks": reactHooksPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
