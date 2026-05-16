import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  // When deployed to GitHub Pages at https://ideriabin.github.io/shmotkee/,
  // assets need to be requested under /shmotkee/. Vite production mode
  // covers both `vite build` and `vite preview`, so both honour this.
  base: mode === 'production' ? '/shmotkee/' : '/',
  server: {
    port: 5180,
    strictPort: true,
    host: true,
  },
}));
