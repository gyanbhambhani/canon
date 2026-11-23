import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "apps/web/out/**",
      "research/**/.venv/**",
      "**/.source/**",
      "**/node_modules/**",
      "reference/**",
      "apps/web/next-env.d.ts",
      "apps/web/public/**",
      "apps/web/lib/generated/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        globalThis: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        self: "readonly",
        window: "readonly",
        document: "readonly",
        URL: "readonly",
        Worker: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
);
