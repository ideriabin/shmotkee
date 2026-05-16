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
</script>

<nav class="nav" aria-label="Главная навигация">
  <a class="wordmark" href="#" tabindex="-1" aria-hidden="true">
    <span class="wordmark-strong">Shmotkee</span>
  </a>

  <ul class="tabs">
    {#each items as item (item.id)}
      <li>
        <button
          class="tab"
          class:active={appState.tab === item.id}
          type="button"
          aria-current={appState.tab === item.id ? 'page' : undefined}
          onclick={() => setTab(item.id)}
        >
          <item.icon size={22} strokeWidth={appState.tab === item.id ? 2 : 1.5} aria-hidden="true" />
          <span class="tab-label">{item.label}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .nav {
    --nav-pad: var(--space-sm);
    background: var(--bg);
    border-top: 1px solid var(--border-soft);
    padding: 0 var(--nav-pad);
    padding-bottom: max(var(--space-3xs), var(--safe-bottom));
    display: flex;
    align-items: center;
    gap: var(--space-md);
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
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: var(--space-2xs) var(--space-3xs);
    color: var(--text-muted);
    min-height: 48px;
    border-radius: var(--radius-1);
    transition: color var(--dur-quick) var(--ease-out);
    position: relative;
  }
  .tab:hover {
    color: var(--text-soft);
  }
  .tab.active {
    color: var(--text);
  }
  .tab.active::after {
    content: '';
    position: absolute;
    inset-inline: 30%;
    bottom: -3px;
    height: 2px;
    background: var(--accent);
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
      flex-direction: column;
      align-items: stretch;
      border-top: none;
      border-right: 1px solid var(--border-soft);
      padding: var(--space-lg) var(--space-md);
      gap: var(--space-2xl);
      width: var(--nav-width-desktop);
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
    .tab.active::after {
      content: '';
      inset-inline: auto;
      inset-block: 30%;
      left: -1px;
      bottom: auto;
      width: 2px;
      height: auto;
    }
  }
</style>
