<script lang="ts">
  /*
   * Theme cycler — system → light → dark → system. Subtle icon-only
   * button. Positioned by the parent (typically top-right corner of
   * the app shell).
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
    <Monitor size={16} strokeWidth={1.6} aria-hidden="true" />
  {:else if themeState.mode === 'light'}
    <Sun size={16} strokeWidth={1.6} aria-hidden="true" />
  {:else}
    <Moon size={16} strokeWidth={1.6} aria-hidden="true" />
  {/if}
</button>

<style>
  .switch {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: 50%;
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  .switch:hover, .switch:active {
    color: var(--text);
    background: var(--surface);
  }
</style>
