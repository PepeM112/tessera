import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import checkFile from "eslint-plugin-check-file";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettierPlugin from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["dist/", "out/", "node_modules/"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ["**/*.{ts,mts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
      "jsx-a11y": jsxA11y,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: "detect" },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.eslint.json",
        },
        node: true,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "prettier/prettier": "off",

      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // TS — type-aware checks
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error", // catches forgotten await on async calls
      "@typescript-eslint/no-misused-promises": [
        "warn",
        {
          // catches async fn where sync expected (e.g. onClick)
          checksVoidReturn: {
            attributes: false, // ← this disables it for JSX props like onSubmit, onClick, etc.
          },
        },
      ],
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }], // enforces `import type { X }`
      "no-unused-vars": "off", // Turned off because @typescript-eslint/no-unused-vars is used
      "no-undef": "off", // TS already handles this

      // React
      "react/self-closing-comp": "warn",
      "react/jsx-boolean-value": ["warn", "never"], // disabled instead of disabled={true}
      "react/jsx-curly-brace-presence": ["warn", { props: "never", children: "never" }], // no unnecessary braces

      // Import
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/default": "error",
      "import/namespace": "error",
      "import/no-cycle": "off",
      "import/no-self-import": "error",
      "import/no-duplicates": "warn", // merges duplicate imports from same module
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "jsx-a11y/anchor-is-valid": "warn",
    },
  },
  // main, preload and config files run in Node, not in the browser
  {
    files: ["src/main/**/*.ts", "src/preload/**/*.ts", "*.config.ts", "*.config.mts", "*.mjs"],
    languageOptions: { globals: globals.node },
  },
  // Disable type-checked rules for JS config files (no tsconfig coverage)
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettierConfig,

  // enforce kebab-case filenames across src/ (matches CLAUDE.md convention)
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    plugins: { "check-file": checkFile },
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{ts,tsx}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
]);
