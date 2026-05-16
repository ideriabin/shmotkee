<script lang="ts">
  /*
   * One-time tip shown to WebKit (iOS Safari / iOS Chrome) users after
   * they've built up a small library. Suggests installing as a PWA so
   * IndexedDB doesn't get evicted by Apple's 7-day inactivity rule.
   */
  import { X, Share, Plus } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import { isWebKitMobile } from '../db/persist';

  const TIP_KEY = 'tds.iosInstallTipDismissed';
  const TIP_TRIGGER_COUNT = 5;

  let visible = $state(false);

  $effect(() => {
    if (!isWebKitMobile()) return;
    if (localStorage.getItem(TIP_KEY) === '1') return;
    // PWA-launched apps don't need the tip.
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const obs = liveQuery(() => db.items.count());
    const sub = obs.subscribe({
      next: (count) => {
        if (count >= TIP_TRIGGER_COUNT) visible = true;
      },
    });
    return () => sub.unsubscribe();
  });

  function dismiss() {
    localStorage.setItem(TIP_KEY, '1');
    visible = false;
  }
</script>

{#if visible}
  <aside class="tip" role="status">
    <div class="tip-body">
      <p class="tip-eyebrow">совет</p>
      <p class="tip-text">
        Поставь как приложение через
        <span class="inline-icon"><Share size={14} strokeWidth={1.6} aria-hidden="true" /></span>
        <strong>Поделиться</strong>
        →
        <span class="inline-icon"><Plus size={14} strokeWidth={1.6} aria-hidden="true" /></span>
        <strong>На экран Домой</strong>.
        Так Safari не выкинет твой гардероб через неделю простоя.
      </p>
    </div>
    <button class="tip-close" type="button" aria-label="Понятно" onclick={dismiss}>
      <X size={18} strokeWidth={1.6} aria-hidden="true" />
    </button>
  </aside>
{/if}

<style>
  .tip {
    position: fixed;
    left: var(--space-sm);
    right: var(--space-sm);
    bottom: calc(var(--nav-height-mobile) + var(--safe-bottom) + var(--space-md) + var(--space-2xs));
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-2);
    padding: var(--space-sm);
    display: flex;
    gap: var(--space-sm);
    align-items: flex-start;
    box-shadow: var(--shadow-elev-2);
    z-index: 60;
    animation: pop var(--dur-medium) var(--ease-out-expo);
  }

  .tip-body {
    flex: 1;
  }
  .tip-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-3xs);
  }
  .tip-text {
    font-size: var(--text-sm);
    color: var(--text);
    line-height: var(--lh-snug);
  }
  .tip-text strong {
    font-weight: var(--w-medium);
  }
  .inline-icon {
    display: inline-flex;
    align-items: center;
    vertical-align: -2px;
  }

  .tip-close {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    flex-shrink: 0;
    transition: color var(--dur-quick) var(--ease-out);
  }
  .tip-close:hover {
    color: var(--text);
  }

  @media (min-width: 900px) {
    .tip {
      left: calc(var(--nav-width-desktop) + var(--space-md));
      right: var(--space-md);
      bottom: var(--space-md);
      max-width: 420px;
    }
  }

  @keyframes pop {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .tip { animation: none; }
  }
</style>
