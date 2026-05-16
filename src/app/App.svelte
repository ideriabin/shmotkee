<script lang="ts">
  import { registerSW } from 'virtual:pwa-register';
  import { appState } from './routes.svelte';
  import NavBar from './nav-bar.svelte';
  import IosInstallTip from './ios-install-tip.svelte';
  import Library from '../library/library.svelte';
  import Compose from '../compose/compose.svelte';
  import Sessions from '../sessions/sessions.svelte';

  // vite-plugin-pwa wires up registration, autoUpdate, and cache cleanup.
  // `immediate: true` reloads as soon as a new SW activates so the user
  // never lands on stale HTML pointing at dead hashed assets.
  $effect(() => {
    if (!import.meta.env.PROD) return;
    registerSW({ immediate: true });
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
