<script lang="ts">
  /*
   * Sequential triage modal — fallback when batch mode doesn't fit.
   * Walks the user through unclassified items one at a time, with a
   * 2×4 grid of buttons (7 slots + "Позже"). "Назад" undoes the
   * previous decision.
   */
  import { X, Undo2 } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item } from '../shared/types';
  import { SLOT_KEYS, SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
  import { updateItem } from '../db/items';
  import Thumb from './thumb.svelte';

  let { onClose }: { onClose: () => void } = $props();

  // Items needing classification — frozen on open so we don't re-shuffle
  // the queue as we work through it. Skipped items get re-added at the tail.
  let queue = $state<Item[]>([]);
  let cursor = $state(0);
  let history = $state<{ itemId: string; prevSlot: SlotKey | null }[]>([]);
  let initialTotal = $state(0);
  let classified = $state(0);
  let leaving = $state(false);

  $effect(() => {
    (async () => {
      const all = await db.items.where('slot').equals(null as any).toArray()
        .catch(async () => db.items.filter((it) => it.slot === null).toArray());
      // Newest first feels more natural — she just uploaded these.
      queue = [...all].sort((a, b) => b.createdAt - a.createdAt);
      initialTotal = queue.length;
      cursor = 0;
      history = [];
      classified = 0;
    })();
  });

  // Live count for the header — drops as she classifies.
  let unclassifiedTotal = $state(0);
  $effect(() => {
    const obs = liveQuery(() => db.items.filter((it) => it.slot === null).count());
    const sub = obs.subscribe({ next: (n) => (unclassifiedTotal = n) });
    return () => sub.unsubscribe();
  });

  const current = $derived(queue[cursor]);
  const finished = $derived(cursor >= queue.length);

  async function assign(slot: SlotKey | 'later') {
    if (!current || leaving) return;
    leaving = true;
    if (slot === 'later') {
      // Push to tail; don't update DB.
      queue = [...queue.slice(0, cursor), ...queue.slice(cursor + 1), current];
      // Don't advance the cursor — next item is at the same index.
    } else {
      history = [...history, { itemId: current.id, prevSlot: current.slot }];
      await updateItem(current.id, { slot });
      classified++;
      cursor++;
    }
    setTimeout(() => (leaving = false), 180);
  }

  async function back() {
    if (history.length === 0 || leaving) return;
    leaving = true;
    const last = history[history.length - 1]!;
    await updateItem(last.itemId, { slot: last.prevSlot });
    history = history.slice(0, -1);
    cursor = Math.max(0, cursor - 1);
    classified = Math.max(0, classified - 1);
    setTimeout(() => (leaving = false), 180);
  }

  function onKey(ev: KeyboardEvent) {
    if (ev.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="triage" role="dialog" aria-modal="true">
  <header class="top">
    <button class="icon-btn" type="button" aria-label="Закрыть" onclick={onClose}>
      <X size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <div class="counter">
      <span class="counter-current">{Math.min(cursor + 1, queue.length || 1)}</span>
      <span class="counter-of">/</span>
      <span class="counter-total">{queue.length}</span>
    </div>
    <button
      class="icon-btn"
      type="button"
      aria-label="Назад"
      disabled={history.length === 0}
      onclick={back}
    >
      <Undo2 size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
  </header>

  <div class="stage" class:leaving>
    {#if finished || !current}
      <div class="done">
        <p class="done-eyebrow">готово</p>
        <p class="done-title">
          <span class="display">Разобрано</span>
          <br />
          <span class="display done-accent">{classified}</span>
        </p>
        {#if unclassifiedTotal > 0}
          <p class="done-hint">Осталось {unclassifiedTotal} «позже» — позже ;)</p>
        {/if}
      </div>
    {:else}
      <div class="card-wrap" data-key={current.id}>
        <div class="card">
          <Thumb blob={current.blob} alt={current.name} />
        </div>
        <p class="card-name">{current.name}</p>
      </div>
    {/if}
  </div>

  <footer class="actions">
    {#if finished || !current}
      <button class="action-close" type="button" onclick={onClose}>
        <span class="display action-close-label">Закрыть</span>
      </button>
    {:else}
      <div class="slot-grid">
        {#each SLOT_KEYS as slot (slot)}
          <button class="slot" type="button" onclick={() => assign(slot)}>
            {SLOT_LABEL_RU[slot]}
          </button>
        {/each}
        <button class="slot slot-later" type="button" onclick={() => assign('later')}>
          Позже
        </button>
      </div>
    {/if}
  </footer>
</div>

<style>
  .triage {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    z-index: 320;
    padding: var(--safe-top) 0 var(--safe-bottom);
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-xs) var(--space-md);
  }

  .icon-btn {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out);
  }
  .icon-btn:hover {
    color: var(--text);
    background: var(--surface);
  }
  .icon-btn:disabled {
    opacity: 0.3;
  }

  .counter {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    display: flex;
    align-items: baseline;
    gap: var(--space-3xs);
    color: var(--text);
  }
  .counter-of, .counter-total {
    color: var(--text-muted);
  }

  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    padding: var(--space-sm) var(--space-md);
  }

  .card-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    animation: card-in var(--dur-medium) var(--ease-out-expo);
    width: 100%;
    max-width: 460px;
  }
  .card {
    width: 100%;
    aspect-ratio: 1;
    background: var(--tile);
    border-radius: var(--radius-2);
    padding: 14%;
    display: grid;
    place-items: center;
    box-shadow: var(--shadow-elev-2);
  }
  .card :global(img) {
    pointer-events: none;
    -webkit-touch-callout: none;
  }
  .card-name {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    color: var(--text);
    text-align: center;
    line-height: 1.1;
  }
  .stage.leaving .card-wrap {
    animation: card-out var(--dur-base) var(--ease-out);
  }

  .actions {
    padding: var(--space-sm) var(--space-md) var(--space-md);
  }

  .slot-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2xs);
  }
  .slot {
    padding: var(--space-sm) var(--space-xs);
    background: var(--surface-2);
    border: 1px solid var(--border-soft);
    color: var(--text);
    font-size: var(--text-lg);
    font-weight: var(--w-medium);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  .slot:hover {
    background: var(--accent);
    color: var(--accent-on);
    border-color: var(--accent);
  }
  .slot:active {
    transform: scale(0.98);
  }
  .slot-later {
    color: var(--text-muted);
    background: transparent;
    border-color: var(--border-soft);
  }
  .slot-later:hover {
    background: var(--surface-3);
    color: var(--text);
    border-color: var(--border);
  }

  .action-close {
    width: 100%;
    padding: var(--space-md);
    background: var(--accent);
    color: var(--accent-on);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .action-close:hover {
    background: var(--accent-hover);
  }
  .action-close-label {
    font-size: var(--text-2xl);
    line-height: 1;
  }

  .done {
    text-align: center;
    padding: var(--space-2xl) var(--space-md);
    max-width: 400px;
  }
  .done-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-sm);
  }
  .done-title {
    font-size: var(--text-3xl);
    color: var(--text);
    line-height: 1.05;
    margin-bottom: var(--space-md);
  }
  .done-accent {
    color: var(--accent);
    font-size: var(--text-4xl);
  }
  .done-hint {
    color: var(--text-muted);
  }

  @keyframes card-in {
    from { transform: translateY(20px) scale(0.96); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }
  @keyframes card-out {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-30%); opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card-wrap { animation: none; }
    .stage.leaving .card-wrap { animation: none; }
  }
</style>
