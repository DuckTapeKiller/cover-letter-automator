import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'off',
        },
        plugins: {
            prettier: eslintPluginPrettier,
        },
        rules: {
            ...eslintConfigPrettier.rules,
            'prettier/prettier': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-require-imports': 'off',
            'preserve-caught-error': 'off',
        },
    },
    {
        ignores: ['node_modules/', 'main.js', 'dist/'],
    }
);
