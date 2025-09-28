import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        ignores: ['**/dist', '**/node_modules', '**/*.d.ts', '**/coverage'],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
            // TypeScript specific rules
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-inferrable-types': 'off',

            // NestJS specific rules
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-member-accessibility': 'off',

            // General code quality rules
            'prefer-const': 'error',
            'no-var': 'error',
            'object-shorthand': 'error',
            'prefer-template': 'error',
            'no-console': 'warn',
            'no-debugger': 'error',

            // Import rules
            'sort-imports': ['error', { ignoreDeclarationSort: true }],
        },
    },
    {
        files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
        },
    },
];
