import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    // Ignored paths
    {
        ignores: [
            ".next/",
            "node_modules/",
            "public/",
            "next-env.d.ts",
        ],
    },

    // Base JS recommended rules
    js.configs.recommended,

    // TypeScript recommended rules
    ...tseslint.configs.recommended,

    // ── Next.js plugin
    {
        plugins: {
            "@next/next": nextPlugin,
        },
        rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs["core-web-vitals"].rules,
        },
    },

    // ── React Hooks plugin ────────────────────────────────────────
    {
        plugins: {
            "react-hooks": reactHooksPlugin,
        },
        rules: reactHooksPlugin.configs.recommended.rules,
    },

    // ── Language / environment options ─────────────────────────────
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
    },

    // ── Custom rule overrides ─────────────────────────────────────
    {
        rules: {
            // Disable base rules that conflict with TypeScript
            "no-undef": "off", // TypeScript handles this
            "no-redeclare": "off", // Conflicts with TS overloads
            "no-unused-vars": "off", // Use TS version below

            // Allow unused vars prefixed with underscore
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            // Warn instead of error for explicit any
            "@typescript-eslint/no-explicit-any": "warn",

            // Allow empty catch blocks (used for localStorage try/catch patterns)
            "no-empty": ["error", {allowEmptyCatch: true}],

            // Allow non-null assertions (commonly used with Map.get()!)
            "@typescript-eslint/no-non-null-assertion": "off",

            // Allow @ts-expect-error with description (used for Leaflet plugin interop)
            "@typescript-eslint/ban-ts-comment": [
                "error",
                {
                    "ts-expect-error": "allow-with-description",
                    "ts-ignore": true,
                    "ts-nocheck": true,
                },
            ],

            // Allow "use client" / "use server" directives
            "no-unused-expressions": "off",
            "@typescript-eslint/no-unused-expressions": [
                "error",
                {
                    allowDirectives: true,
                    allowShortCircuit: true,
                    allowTernary: true,
                    allowTaggedTemplates: true,
                },
            ],
        },
    },
);
