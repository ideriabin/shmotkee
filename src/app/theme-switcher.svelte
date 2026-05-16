<script lang="ts">
  /*
   * Cycles through system → light → dark → system. Shows the current
   * mode's icon. Subtle button, lives in the nav-bar.
   */
  import { Sun, Moon, Monitor } from 'lucide-svelte';
  import { themeState, setTheme, type ThemeMode } from './theme.svelte';

  function nextMode(cur: ThemeMode): ThemeMode {
    if (cur === 'system') return 'light';
    if (cur === 'light') return 'dark';
    return 'system';
  }

  function cycle() {
    setTheme(nextMode(themeState.mode));
  }

  const labels: Record<ThemeMode, string> = {
    system: 'Системная тема',
    light: 'Светлая тема',
    dark: 'Тёмная тема',
  };
</script>

<button
  type="button"
  class="switch"
  aria-label={labels[themeState.mode]}
  title={labels[themeState.mode]}
  onclick={cycle}
>
  {#if themeState.mode === 'system'}
    <Monitor size={18} strokeWidth={1.6} aria-hidden="true" />
  {:else if themeState.mode === 'light'}
    <Sun size={18} strokeWidth={1.6} aria-hidden="true" />
  {:else}
    <Moon size={18} strokeWidth={1.6} aria-hidden="true" />
  {/if}
  <span class="switch-label">
    {themeState.mode === 'system' ? 'Авто' : themeState.mode === 'light' ? 'Свет' : 'Тьма'}
  </span>
</button>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-3xs) var(--space-2xs);
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out);
  }
  .switch:hover {
    color: var(--text);
    background: var(--surface);
  }

  .switch-label {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    font-weight: var(--w-medium);
    display: none;
  }

  @media (min-width: 900px) {
    .switch-label {
      display: inline;
    }
  }
</style>
