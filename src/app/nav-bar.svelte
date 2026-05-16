<script lang="ts">
  import { Shirt, Sparkles, BookmarkCheck } from 'lucide-svelte';
  import { appState, setTab, type Tab } from './routes.svelte';

  type NavItem = {
    id: Tab;
    label: string;
    icon: typeof Shirt;
  };

  const items: NavItem[] = [
    { id: 'library', label: 'Гардероб', icon: Shirt },
    { id: 'compose', label: 'Собрать', icon: Sparkles },
    { id: 'sessions', label: 'Образы', icon: BookmarkCheck },
  ];

  // Drive the underline indicator: a single element that slides between
  // tab positions instead of three independent ::after underlines that snap.
  const tabIndex = $derived(items.findIndex((i) => i.id === appState.tab));
</script>

<nav class="nav" aria-label="Главная навигация">
  <a class="wordmark" href="#" tabindex="-1" aria-hidden="true">
    <span class="wordmark-strong">Shmotkee</span>
  </a>

  <ul class="tabs" style:--tab-index={tabIndex}>
    {#each items as item (item.id)}
      <li>
        <button
          class="tab"
          class:active={appState.tab === item.id}
          type="button"
          aria-current={appState.tab === item.id ? 'page' : undefined}
          onclick={() => setTab(item.id)}
        >
          <span class="tab-icon">
            <item.icon size={22} strokeWidth={appState.tab === item.id ? 2 : 1.5} aria-hidden="true" />
          </span>
          <span class="tab-label">{item.label}</span>
        </button>
      </li>
    {/each}
    <span class="indicator" aria-hidden="true"></span>
  </ul>
</nav>

<style>
  .nav {
    --nav-pad: var(--space-sm);
    /* Translucent: content scrolls behind the nav so the last list
       items pass under it with a subtle blur. */
    background: color-mix(in oklab, var(--bg) 78%, transparent);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border-top: 1px solid var(--border-soft);
    padding: var(--space-3xs) var(--nav-pad);
    /* iOS reports ~34px for safe-area-inset-bottom (home indicator),
       but only ~16px is visually needed — subtract the overshoot so
       tabs sit close to the indicator without an empty space below
       them. The max() clamp keeps a sensible minimum for devices
       without a home indicator. */
    padding-bottom: max(var(--space-3xs), calc(var(--safe-bottom) - 18px));
    display: flex;
    align-items: center;
    gap: var(--space-md);
    /* Anchored to the bottom edge — content scrolls under it via
     .tab-page's matching padding-bottom. Saves ~20px of vertical
     real estate vs the floating variant. */
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
  }

  .wordmark {
    display: none;
    text-decoration: none;
    color: inherit;
    line-height: 1;
  }
  .wordmark-strong {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--text);
    letter-spacing: var(--track-tight);
  }

  .tabs {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3xs);
    position: relative;
  }
  /* Sliding accent underline that anchors the active tab. Sits at
     the bottom of the tabs row (just above the safe-bottom padding
     of the nav) so it reads as a single confident line that moves
     between tab columns. --tab-index is set inline. */
  .indicator {
    position: absolute;
    width: calc((100% - 2 * var(--space-3xs)) / 3);
    height: 2px;
    bottom: 0;
    left: calc(var(--tab-index, 0) * (100% + var(--space-3xs)) / 3);
    background: var(--accent);
    border-radius: var(--radius-pill);
    transform: scaleX(0.4);
    transform-origin: center;
    transition:
      left var(--dur-base) var(--ease-out-expo),
      transform var(--dur-quick) var(--ease-out);
    will-change: left, transform;
  }

  .tab {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: var(--space-3xs) var(--space-3xs);
    color: var(--text-muted);
    min-height: 44px;
    border-radius: var(--radius-1);
    transition: color var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
    position: relative;
    z-index: 1;
  }
  /* Fixed-size icon container — lucide glyphs vary in width within
     their 24×24 viewBox, so without a constant bounding box the labels
     can drift up/down between tabs. This pins them to the same baseline. */
  .tab-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
  }
  @media (hover: hover) {
    .tab:hover {
      color: var(--text-soft);
    }
  }
  .tab:active {
    transform: scale(0.94);
    transition-duration: 60ms;
  }
  .tab.active {
    color: var(--text);
  }

  .tab-label {
    font-size: var(--text-xs);
    font-weight: var(--w-medium);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
  }

  /* Desktop: vertical side nav with wordmark on top. */
  @media (min-width: 900px) {
    .nav {
      position: static;
      flex-direction: column;
      align-items: stretch;
      border: none;
      border-right: 1px solid var(--border-soft);
      border-radius: 0;
      padding: var(--space-lg) var(--space-md);
      gap: var(--space-2xl);
      width: var(--nav-width-desktop);
      /* Solid background on desktop — no behind-content to blur. */
      background: var(--bg);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      box-shadow: none;
    }
    .wordmark {
      display: block;
    }
    .tabs {
      display: flex;
      flex-direction: column;
      gap: var(--space-2xs);
    }
    .tab {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: var(--space-xs);
      padding: var(--space-xs) var(--space-sm);
      min-height: 44px;
    }
    .tab-label {
      font-size: var(--text-md);
      letter-spacing: var(--track-normal);
      text-transform: none;
    }
    .indicator { display: none; }
    .tab.active::after {
      content: '';
      position: absolute;
      inset-block: 30%;
      left: -1px;
      width: 2px;
      background: var(--accent);
    }
  }
</style>
