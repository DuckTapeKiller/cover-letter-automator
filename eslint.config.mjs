import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import { DEFAULT_BRANDS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js';
import { DEFAULT_ACRONYMS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/acronyms.js';
import eslintPluginPrettier from 'eslint-plugin-prettier';

export default defineConfig([
    { ignores: ['main.js'] },
    ...obsidianmd.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: ['eslint.config.mjs', 'esbuild.config.mjs'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: { prettier: eslintPluginPrettier },
        rules: {
            'prettier/prettier': 'error',
            // Custom lists replace the defaults, so ours are appended to them.
            'obsidianmd/ui/sentence-case': [
                'warn',
                {
                    brands: [
                        ...DEFAULT_BRANDS,
                        'Cover Letter Automator',
                        'Ollama',
                        'LM Studio',
                        'llama.cpp',
                        'OpenRouter',
                        'Groq',
                        'British English',
                        'American English',
                        'Spanish',
                        'Mac',
                    ],
                    acronyms: [...DEFAULT_ACRONYMS, 'CV', 'DOCX', 'GB'],
                },
            ],
        },
    },
    {
        // The build script runs in Node, where process is a global.
        files: ['esbuild.config.mjs'],
        languageOptions: { globals: { process: 'readonly' } },
    },
]);
