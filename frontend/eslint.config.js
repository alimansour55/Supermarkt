import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'build', 'build-spa', '.react-router']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // Genuine-bug rules stay as errors.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The React-Compiler-derived rules added in eslint-plugin-react-hooks v7
      // are useful signal but fire heavily on established patterns (the
      // "latest ref" idiom, loading-flag effects). Keep them visible as
      // warnings instead of failing the whole lint run.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/incompatible-library': 'warn',
      // Fast-refresh hint (context/helper files exporting non-components) —
      // a dev-only ergonomics concern, not a correctness issue.
      // Navigation must go through src/app/router.jsx so storefront links keep the /ar|/en prefix.
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'react-router-dom', message: "Import from src/app/router instead (language-aware links)." },
          {
            name: 'react-router',
            importNames: ['Link', 'NavLink', 'Navigate', 'useNavigate', 'useLocation'],
            message: 'Import these from src/app/router (language-aware versions).',
          },
        ],
      }],
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
        // React Router route-module exports
        allowExportNames: ['meta', 'links', 'headers', 'loader', 'clientLoader', 'action', 'clientAction', 'handle', 'shouldRevalidate', 'ErrorBoundary', 'HydrateFallback', 'Layout'],
      }],
    },
  },
  {
    // The wrapper itself builds on the raw React Router APIs.
    files: ['src/app/router.jsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Node-side files (SSR server, build config, route config, server-only modules)
    files: ['server.js', '*.config.js', 'src/routes.js', 'src/**/*.server.js'],
    languageOptions: { globals: globals.node },
  },
])
