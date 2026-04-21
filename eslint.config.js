import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'vendor/**',
      'prototypes/**',
      'node_modules/**',
      '.svelte-kit/**',
      'build/**',
      'static/wasm/**',
      'wasm/output/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte', '.svelte.ts']
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // JSROOT uses any for painter objects
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'svelte/no-at-debug-tags': 'warn',
      'svelte/valid-compile': 'error',
      // Disable rules that are too strict for scaffolding phase
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/valid-prop-names-in-kit-pages': 'off',
      'svelte/prefer-svelte-reactivity': 'off', // Allow Map for now; will migrate to SvelteMap later
      'preserve-caught-error': 'off'
    }
  }
);
