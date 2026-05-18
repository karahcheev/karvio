import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    ignores: ["dist", "node_modules", "coverage"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/\\b(?:text|bg|border|ring|stroke|fill)-(?:red|amber|green|blue|gray|orange)-\\d{2,3}(?:\\/\\d{1,3})?\\b/]",
          message:
            "Use semantic theme classes/tokens (status/action/tone) instead of raw palette utilities like text-red-600.",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(?:text|bg|border|ring|stroke|fill)-(?:red|amber|green|blue|gray|orange)-\\d{2,3}(?:\\/\\d{1,3})?\\b/]",
          message:
            "Use semantic theme classes/tokens (status/action/tone) instead of raw palette utilities like text-red-600.",
        },
      ],
    },
  },
];
