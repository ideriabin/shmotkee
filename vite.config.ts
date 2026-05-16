import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  // When deployed to GitHub Pages at https://ideriabin.github.io/shmotkee/,
  // assets need to be requested under /shmotkee/. Vite production mode
  // covers both `vite build` and `vite preview`, so both honour this.
  base: mode === 'production' ? '/shmotkee/' : '/',
  plugins: [
    svelte(),
    VitePWA({
      // autoUpdate = SW updates itself silently in the background; the
      // page reloads via the controllerchange listener wired up in App.
      registerType: 'autoUpdate',
      // The plugin generates both manifest.webmanifest and sw.js (no
      // hand-rolled SW any more).
      manifest: {
        name: 'Shmotkee',
        short_name: 'Shmotkee',
        description: 'Локальный конструктор образов из своего гардероба.',
        lang: 'ru',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#171012',
        theme_color: '#171012',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache every static asset the build emits. Hashed filenames
        // mean cached entries never go stale; new builds invalidate the
        // precache via the generated revision manifest.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Single-page-app fallback so any URL inside the scope returns
        // the cached index.html (which then loads the latest assets).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5180,
    strictPort: true,
    host: true,
  },
}));
