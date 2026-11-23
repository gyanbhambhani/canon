import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "apps/web/out/**",
      "research/**/.venv/**",
      ".claude/**",
      "**/.source/**",
      "**/node_modules/**",
      "reference/**",
      "apps/web/next-env.d.ts",
      "apps/web/public/**",
      "apps/web/lib/generated/**",
      "test-results/**",
      "research/**/.work/**",
      ".claude/**",
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
  {
    // CanonBench's analysis scripts are pinned by hash in its pre-registration: lint must not edit them
    files: ["research/canonbench/analysis/**"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
);
