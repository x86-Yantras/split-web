import { defineConfig } from 'vite';

// SplitSplit keeps its original window-global architecture (no ESM rewrite).
// Vite/esbuild just transpiles the JSX and serves ES modules. The OAuth client's
// authorized origin is http://localhost:5174, so the dev server is pinned there.
export default defineConfig({
  base: '/split-web/',
  server: { host: 'localhost', port: 5174, strictPort: true },
  preview: { host: 'localhost', port: 5174, strictPort: true },
  esbuild: {
    // Classic runtime: JSX compiles to React.createElement, resolved from the
    // React import injected below. The screens reference shared UI primitives
    // (SS, Avatar, Money, ...) and sibling screens as window globals at render time.
    jsx: 'transform',
    jsxInject: "import React from 'react'",
  },
});
