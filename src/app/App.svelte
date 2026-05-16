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
  //
  // updateViaCache: 'none' guarantees the browser always checks the
  // network for sw.js itself (the SW file is never stale-cached). And
  // when the new SW takes over (becomes the active controller), we
  // reload the page so the freshly-fetched HTML/assets render.
  $effect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .catch(() => {});

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
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
    position: relative;
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
