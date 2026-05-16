<script lang="ts">
  import { X, Check } from 'lucide-svelte';
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
    initial: Item[];
    onConfirm: (locked: Item[]) => void;
    onClose: () => void;
  } = $props();

  let items = $state<Item[]>([]);
  let selectedIds = $state(new Set(initial.map((i) => i.id)));
  let filter = $state<'all' | SlotKey>('all');

  $effect(() => {
    // Unclassified items can't be locked because the generator can't place
    // them; filter them out at source.
    const obs = liveQuery(() =>
      db.items.orderBy('createdAt').filter((it) => it.slot !== null).reverse().toArray(),
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

  function confirm() {
    onConfirm(items.filter((it) => selectedIds.has(it.id)));
  }
</script>

<div
  class="overlay"
  role="dialog"
  aria-modal="true"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div class="sheet">
    <header class="sheet-head">
      <h2 class="sheet-title">Закрепить вещи</h2>
      <button class="icon-btn" type="button" aria-label="Закрыть" onclick={onClose}>
        <X size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </header>

    <div class="filters">
      <button class="filter" class:active={filter === 'all'} onclick={() => (filter = 'all')}>Все</button>
      {#each SLOT_KEYS as slot (slot)}
        <button class="filter" class:active={filter === slot} onclick={() => (filter = slot)}>
          {SLOT_LABEL_RU[slot]}
        </button>
      {/each}
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

    <footer class="sheet-foot">
      <span class="count">Выбрано: <strong>{selectedIds.size}</strong></span>
      <button class="primary" type="button" onclick={confirm}>Закрепить</button>
    </footer>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 200;
    animation: fade-in var(--dur-base) var(--ease-out);
  }
  .sheet {
    background: var(--surface);
    width: 100%;
    max-width: 760px;
    border-top: 1px solid var(--border);
    border-radius: var(--radius-2) var(--radius-2) 0 0;
    padding: var(--space-md);
    padding-bottom: calc(var(--space-md) + var(--safe-bottom));
    max-height: 92dvh;
    display: flex;
    flex-direction: column;
    animation: slide-up var(--dur-medium) var(--ease-out-expo);
  }

  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-sm);
  }
  .sheet-title {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    color: var(--text);
    line-height: 1;
  }
  .icon-btn {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
  }
  .icon-btn:hover {
    color: var(--text);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3xs);
    margin-bottom: var(--space-sm);
  }
  .filter {
    padding: var(--space-3xs) var(--space-xs);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-soft);
    color: var(--text-soft);
    font-size: var(--text-sm);
    transition: all var(--dur-quick) var(--ease-out);
  }
  .filter.active {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }

  .grid {
    display: grid;
    gap: var(--space-2xs);
    grid-template-columns: repeat(3, 1fr);
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: var(--space-sm);
  }
  @media (min-width: 600px) {
    .grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (min-width: 900px) {
    .grid { grid-template-columns: repeat(5, 1fr); }
  }

  .tile {
    width: 100%;
    text-align: left;
    border-radius: var(--radius-2);
    overflow: hidden;
  }
  .tile-photo {
    background: var(--tile);
    aspect-ratio: 1;
    padding: 8%;
    position: relative;
    transition: outline var(--dur-quick) var(--ease-out);
    outline: 2px solid transparent;
    outline-offset: -2px;
    border-radius: var(--radius-2);
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

  .sheet-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border-soft);
    gap: var(--space-sm);
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
    transition: background var(--dur-quick) var(--ease-out);
  }
  .primary:hover {
    background: var(--accent-hover);
  }

  @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
  @media (prefers-reduced-motion: reduce) {
    .overlay, .sheet { animation: none; }
  }
</style>
