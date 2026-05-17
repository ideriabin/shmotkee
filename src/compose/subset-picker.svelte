<script lang="ts">
  /*
   * Подборка picker — curate the pool the generator draws from.
   *
   * Same shape as lock-picker, but semantically different: subset is a
   * source restriction (which items can appear), lock is an output
   * requirement (which items must appear). Confirming an empty selection
   * is interpreted as "no subset" (full wardrobe), which is also the
   * "Сбросить" shortcut's destination.
   */
  import { X, Check, CheckCheck, Eraser } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item } from '../shared/types';
  import { SLOT_KEYS, SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
  import Thumb from '../library/thumb.svelte';

  let {
    initial,
    onConfirm,
    onClose,
  }: {
    initial: string[] | null;
    onConfirm: (ids: string[] | null) => void;
    onClose: () => void;
  } = $props();

  let items = $state<Item[]>([]);
  // Snapshot the initial selection at mount.
  // svelte-ignore state_referenced_locally
  let selectedIds = $state(new Set<string>(initial ?? []));
  let filter = $state<'all' | SlotKey>('all');

  $effect(() => {
    // Same filter as the library: active, classified items.
    const obs = liveQuery(() =>
      db.items
        .orderBy('createdAt')
        .filter((it) => it.slot !== null && !it.deletedAt)
        .reverse()
        .toArray(),
    );
    const sub = obs.subscribe({ next: (v) => (items = v) });
    return () => sub.unsubscribe();
  });

  const filtered = $derived(filter === 'all' ? items : items.filter((it) => it.slot === filter));

  function toggle(id: string) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    selectedIds = new Set(selectedIds);
  }

  function selectAllFiltered() {
    const next = new Set(selectedIds);
    for (const it of filtered) next.add(it.id);
    selectedIds = next;
  }

  function clearAll() {
    selectedIds = new Set();
  }

  function confirm() {
    // Empty selection → null subset = full wardrobe. Saves the wife a step:
    // tap "Сбросить" → "Готово" gets you back to no subset.
    if (selectedIds.size === 0) {
      onConfirm(null);
    } else {
      onConfirm([...selectedIds]);
    }
  }

  let closing = $state(false);
  function requestClose() {
    if (closing) return;
    closing = true;
    setTimeout(onClose, 220);
  }
</script>

<div class="picker" class:closing role="dialog" aria-modal="true">
  <header class="top-bar">
    <button class="icon-btn" type="button" aria-label="Закрыть" onclick={requestClose}>
      <X size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <h2 class="top-title">Подборка</h2>
    <span class="top-spacer"></span>
  </header>

  <div class="filters" role="tablist">
    <button class="filter" class:active={filter === 'all'} onclick={() => (filter = 'all')}>Все</button>
    {#each SLOT_KEYS as slot (slot)}
      <button class="filter" class:active={filter === slot} onclick={() => (filter = slot)}>
        {SLOT_LABEL_RU[slot]}
      </button>
    {/each}
  </div>

  <div class="bulk-actions">
    <button class="bulk-btn" type="button" onclick={selectAllFiltered}>
      <CheckCheck size={14} strokeWidth={1.8} aria-hidden="true" />
      <span>Выбрать все{filter !== 'all' ? ' в категории' : ''}</span>
    </button>
    <button class="bulk-btn" type="button" onclick={clearAll} disabled={selectedIds.size === 0}>
      <Eraser size={14} strokeWidth={1.8} aria-hidden="true" />
      <span>Сбросить</span>
    </button>
  </div>

  <ul class="grid">
    {#each filtered as item (item.id)}
      <li>
        <button
          type="button"
          class="tile"
          class:selected={selectedIds.has(item.id)}
          onclick={() => toggle(item.id)}
          aria-pressed={selectedIds.has(item.id)}
        >
          <div class="tile-photo">
            <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} />
            {#if selectedIds.has(item.id)}
              <div class="check"><Check size={18} strokeWidth={2.4} aria-hidden="true" /></div>
            {/if}
          </div>
          <p class="tile-name">{item.name}</p>
        </button>
      </li>
    {/each}
  </ul>

  <footer class="bottom-bar">
    <span class="count">
      {#if selectedIds.size === 0}
        Пусто — будет весь гардероб
      {:else}
        Выбрано: <strong>{selectedIds.size}</strong>
      {/if}
    </span>
    <button class="primary" type="button" onclick={confirm}>Готово</button>
  </footer>
</div>

<style>
  .picker {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    z-index: 200;
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
    animation: picker-in var(--dur-medium) var(--ease-out-expo);
  }
  .picker.closing {
    animation: picker-out var(--dur-base) var(--ease-out) forwards;
  }
  @keyframes picker-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes picker-out {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(8px); }
  }

  .top-bar {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--border-soft);
  }
  .top-title {
    text-align: center;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--text);
    line-height: 1;
    margin: 0;
  }
  .top-spacer { display: block; }

  .icon-btn {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .icon-btn:hover { color: var(--text); background: var(--surface); }
  }
  .icon-btn:active {
    transform: scale(0.9);
    background: var(--surface);
    color: var(--text);
    transition-duration: 60ms;
  }

  .filters {
    display: flex;
    gap: var(--space-3xs);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding: var(--space-2xs) var(--space-md);
    -webkit-overflow-scrolling: touch;
  }
  .filters::-webkit-scrollbar { display: none; }
  .filter {
    padding: var(--space-3xs) var(--space-xs);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-soft);
    color: var(--text-soft);
    font-size: var(--text-sm);
    white-space: nowrap;
    flex-shrink: 0;
    transition: all var(--dur-quick) var(--ease-out);
    background: transparent;
  }
  .filter.active {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }

  .bulk-actions {
    display: flex;
    gap: var(--space-2xs);
    padding: 0 var(--space-md) var(--space-2xs);
    border-bottom: 1px solid var(--border-soft);
  }
  .bulk-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    padding: var(--space-3xs) var(--space-xs);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-soft);
    background: transparent;
    color: var(--text);
    font-size: var(--text-sm);
    transition: background var(--dur-quick) var(--ease-out), border-color var(--dur-quick) var(--ease-out);
  }
  .bulk-btn:hover:not(:disabled) {
    background: var(--surface);
  }
  .bulk-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .grid {
    display: grid;
    gap: var(--space-2xs);
    grid-template-columns: repeat(3, 1fr);
    overflow-y: auto;
    overscroll-behavior-y: contain;
    flex: 1;
    min-height: 0;
    padding: var(--space-sm) var(--space-md);
    -webkit-overflow-scrolling: touch;
  }
  @media (min-width: 600px) {
    .grid { grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); }
  }
  @media (min-width: 900px) {
    .grid { grid-template-columns: repeat(5, 1fr); }
  }
  @media (min-width: 1200px) {
    .grid { grid-template-columns: repeat(6, 1fr); }
  }

  .tile {
    width: 100%;
    text-align: left;
    border-radius: var(--radius-2);
    overflow: hidden;
    touch-action: manipulation;
    transition: transform var(--dur-quick) var(--ease-out);
  }
  .tile:active {
    transform: scale(0.97);
    transition-duration: 60ms;
  }
  .tile-photo {
    background: var(--tile);
    aspect-ratio: 1;
    padding: 8%;
    position: relative;
    transition: outline var(--dur-quick) var(--ease-out);
    outline: 2px solid transparent;
    outline-offset: -2px;
    border-radius: var(--radius-3);
  }
  .tile-photo :global(img) {
    pointer-events: none;
  }
  .tile.selected .tile-photo {
    outline-color: var(--accent);
  }
  .check {
    position: absolute;
    top: var(--space-3xs);
    right: var(--space-3xs);
    background: var(--accent);
    color: var(--accent-on);
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .tile-name {
    margin-top: var(--space-3xs);
    font-size: var(--text-sm);
    color: var(--text);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-clamp: 1;
  }

  .bottom-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--border-soft);
    gap: var(--space-sm);
    background: var(--surface);
  }
  .count {
    color: var(--text-muted);
    font-size: var(--text-md);
  }
  .count strong {
    color: var(--text);
    font-weight: var(--w-semibold);
  }
  .primary {
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-2);
    font-family: var(--font-display);
    font-size: var(--text-xl);
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .primary:hover { background: var(--accent-hover); }
  }
  .primary:active {
    background: var(--accent-hover);
    transform: scale(0.98);
    transition-duration: 60ms;
  }

  @media (prefers-reduced-motion: reduce) {
    .picker, .picker.closing { animation: none; }
  }
</style>
