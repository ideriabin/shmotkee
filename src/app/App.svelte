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
    <div class="tab-page" class:active={appState.tab === 'library'} aria-hidden={appState.tab !== 'library'}>
      <Library />
    </div>
    <div class="tab-page" class:active={appState.tab === 'compose'} aria-hidden={appState.tab !== 'compose'}>
      <Compose />
    </div>
    <div class="tab-page" class:active={appState.tab === 'sessions'} aria-hidden={appState.tab !== 'sessions'}>
      <Sessions />
    </div>
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

  /* All three tab pages live in a single positioned wrapper so we can
     crossfade between them without losing scroll position or
     remounting state. Each page is its own scroll container; switching
     tabs swaps which one is visible & receiving pointer events.

     On mobile, the nav floats translucently over the content so the
     last item of the list can scroll behind it — that's why
     .tab-page has bottom padding equal to nav height + safe-area. */
  .content {
    flex: 1;
    min-height: 0;
    position: relative;
  }
  .tab-page {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: var(--safe-top);
    /* Clear the floating nav: nav visual height + bottom gap + below-nav margin. */
    padding-bottom: calc(var(--nav-height-mobile) + var(--safe-bottom) + var(--space-sm));
    overscroll-behavior-y: contain;
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-base) var(--ease-out);
    -webkit-overflow-scrolling: touch;
  }
  .tab-page.active {
    opacity: 1;
    pointer-events: auto;
  }

  @media (min-width: 900px) {
    .shell {
      flex-direction: row-reverse;
    }
    .tab-page {
      padding-top: 0;
      padding-bottom: 0;
    }
  }
</style>
