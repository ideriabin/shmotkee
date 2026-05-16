<script lang="ts">
  import { appState } from './routes.svelte';
  import NavBar from './nav-bar.svelte';
  import IosInstallTip from './ios-install-tip.svelte';
  import Library from '../library/library.svelte';
  import Compose from '../compose/compose.svelte';
  import Sessions from '../sessions/sessions.svelte';

  // Register the service worker once on app start. In dev (no production
  // build), we silently skip — vite serves /sw.js but registering during
  // HMR is noisy and unnecessary. In prod the worker lives under the
  // configured base path (`/shmotkee/sw.js` on GitHub Pages).
  $effect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
        .catch(() => {});
    }
  });
</script>

<div class="shell">
  <main class="content">
    {#if appState.tab === 'library'}
      <Library />
    {:else if appState.tab === 'compose'}
      <Compose />
    {:else}
      <Sessions />
    {/if}
  </main>
  <NavBar />
  <IosInstallTip />
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: var(--safe-top);
  }

  @media (min-width: 900px) {
    .shell {
      flex-direction: row-reverse;
    }
    .content {
      padding-top: 0;
    }
  }
</style>
