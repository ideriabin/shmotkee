<script lang="ts">
  import { Plus, X, ListChecks, CheckCheck, MoveRight } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item } from '../shared/types';
  import {
    SLOT_KEYS,
    SLOT_LABEL_RU,
    type SlotKey,
  } from '../shared/slots';
  import { plural, OUTFITS } from '../shared/ru-plural';
  import { updateItemSlots, snapshotSlots, restoreItemSlots } from '../db/items';
  import Thumb from './thumb.svelte';
  import UploadSheet from './upload-sheet.svelte';
  import ItemDetail from './item-detail.svelte';
  import Triage from './triage.svelte';

  type Filter = 'all' | 'unclassified' | SlotKey;

  let filter = $state<Filter>('all');
  let items = $state<Item[]>([]);
  let showUpload = $state(false);
  let detailItem = $state<Item | null>(null);
  let triageOpen = $state(false);

  // Selection mode: any non-empty set means we're in selection mode.
  let selectedIds = $state(new Set<string>());

  // Undo state — captured on every batch move.
  let lastAction = $state<{
    snapshot: Map<string, SlotKey | null>;
    targetSlot: SlotKey | null;
    count: number;
  } | null>(null);
  let undoVisible = $state(false);
  let undoTimer: number | undefined;

  $effect(() => {
    const obs = liveQuery(() => db.items.orderBy('createdAt').reverse().toArray());
    const sub = obs.subscribe({
      next: (v) => {
        items = v;
      },
    });
    return () => sub.unsubscribe();
  });

  // Auto-redirect filter when the active one runs out of items.
  // Specifically: when triage clears everything, drop back to "all".
  $effect(() => {
    if (filter === 'unclassified' && items.filter((it) => it.slot === null).length === 0 && items.length > 0) {
      filter = 'all';
    }
  });

  const filtered = $derived.by(() => {
    if (filter === 'all') return items;
    if (filter === 'unclassified') return items.filter((it) => it.slot === null);
    return items.filter((it) => it.slot === filter);
  });

  const slotCounts = $derived.by(() => {
    const counts: Record<string, number> = { all: items.length, unclassified: 0 };
    for (const key of SLOT_KEYS) counts[key] = 0;
    for (const it of items) {
      if (it.slot === null) counts.unclassified++;
      else counts[it.slot] = (counts[it.slot] ?? 0) + 1;
    }
    return counts;
  });

  const inSelection = $derived(selectedIds.size > 0);

  // ─── Long-press / tap handling ─────────────────────────────────────
  let pressTimer: number | undefined;
  let pressedId: string | null = null;
  let pressMoved = false;
  const LONG_PRESS_MS = 350;
  const MOVE_TOLERANCE = 8;
  let pressStartX = 0;
  let pressStartY = 0;

  function onTilePointerDown(item: Item, ev: PointerEvent) {
    pressedId = item.id;
    pressMoved = false;
    pressStartX = ev.clientX;
    pressStartY = ev.clientY;
    pressTimer = window.setTimeout(() => {
      // Long-press → enter selection mode with this item checked.
      toggleSelection(item.id);
      // Haptic feedback when available.
      if (navigator.vibrate) navigator.vibrate(10);
    }, LONG_PRESS_MS);
  }

  function onTilePointerMove(ev: PointerEvent) {
    if (pressedId === null) return;
    if (
      Math.abs(ev.clientX - pressStartX) > MOVE_TOLERANCE ||
      Math.abs(ev.clientY - pressStartY) > MOVE_TOLERANCE
    ) {
      pressMoved = true;
      if (pressTimer) window.clearTimeout(pressTimer);
    }
  }

  function onTilePointerUp() {
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = undefined;
    pressedId = null;
  }

  function onTileClick(item: Item) {
    if (pressMoved) return;
    if (inSelection) {
      toggleSelection(item.id);
    } else {
      // Only treat as a click if the long-press didn't fire.
      detailItem = item;
    }
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  function selectAllVisible() {
    selectedIds = new Set(filtered.map((it) => it.id));
  }

  // ─── Batch move + undo ─────────────────────────────────────────────
  async function batchAssign(slot: SlotKey) {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const snapshot = await snapshotSlots(ids);
    await updateItemSlots(ids, slot);
    lastAction = { snapshot, targetSlot: slot, count: ids.length };
    showUndo();
    clearSelection();
  }

  function showUndo() {
    undoVisible = true;
    if (undoTimer) window.clearTimeout(undoTimer);
    undoTimer = window.setTimeout(() => {
      undoVisible = false;
      lastAction = null;
    }, 5000);
  }

  async function undo() {
    if (!lastAction) return;
    await restoreItemSlots(lastAction.snapshot);
    if (undoTimer) window.clearTimeout(undoTimer);
    undoVisible = false;
    lastAction = null;
  }

  function exitSelectionMode() {
    clearSelection();
  }

  // ─── Filter chip click — only when NOT in selection mode ───────────
  function setFilter(next: Filter) {
    if (inSelection) return; // chips are drop targets instead
    filter = next;
  }
</script>

<section class="page">
  {#if inSelection}
    <header class="hero hero-select">
      <div class="select-bar">
        <button class="icon-btn" type="button" aria-label="Отмена" onclick={exitSelectionMode}>
          <X size={20} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <span class="select-count">
          <span class="display select-count-n">{selectedIds.size}</span>
          <span class="select-count-label">выбрано</span>
        </span>
        <button class="ghost" type="button" onclick={selectAllVisible}>
          <CheckCheck size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>все</span>
        </button>
      </div>
      <p class="select-hint">Тапни слот, чтобы переместить.</p>
      <div class="drop-strip" role="toolbar" aria-label="Куда переместить">
        {#each SLOT_KEYS as slot (slot)}
          <button class="drop-chip" type="button" onclick={() => batchAssign(slot)}>
            <MoveRight size={12} strokeWidth={1.8} aria-hidden="true" />
            <span>{SLOT_LABEL_RU[slot]}</span>
          </button>
        {/each}
      </div>
    </header>
  {:else}
    <header class="hero">
      <h1 class="title">
        <span class="display title-strong">Гардероб</span>
        <span class="title-count">{items.length}</span>
      </h1>

      <div class="filters" role="tablist" aria-label="Фильтр по слотам">
        {#if slotCounts.unclassified > 0}
          <button
            role="tab"
            type="button"
            class="filter filter-warn"
            class:active={filter === 'unclassified'}
            aria-selected={filter === 'unclassified'}
            onclick={() => setFilter('unclassified')}
          >
            Без слота
            <span class="filter-count">{slotCounts.unclassified}</span>
          </button>
        {/if}
        <button
          role="tab"
          type="button"
          class="filter"
          class:active={filter === 'all'}
          aria-selected={filter === 'all'}
          onclick={() => setFilter('all')}
        >
          Все
          <span class="filter-count">{slotCounts.all}</span>
        </button>
        {#each SLOT_KEYS as slot (slot)}
          <button
            role="tab"
            type="button"
            class="filter"
            class:active={filter === slot}
            aria-selected={filter === slot}
            onclick={() => setFilter(slot)}
          >
            {SLOT_LABEL_RU[slot]}
            <span class="filter-count">{slotCounts[slot] ?? 0}</span>
          </button>
        {/each}
      </div>

      {#if filter === 'unclassified' && slotCounts.unclassified > 0}
        <div class="triage-bar">
          <button class="triage-btn" type="button" onclick={() => (triageOpen = true)}>
            <ListChecks size={18} strokeWidth={1.6} aria-hidden="true" />
            <span class="display triage-label">Разобрать по одному</span>
            <span class="triage-count">{slotCounts.unclassified}</span>
          </button>
        </div>
      {/if}
    </header>
  {/if}

  {#if items.length === 0}
    <div class="empty">
      <p class="empty-eyebrow">пусто</p>
      <p class="empty-title">
        <span class="display">Закинь сюда</span>
        <br />
        <span class="display empty-title-accent">первую вещь.</span>
      </p>
      <p class="empty-hint">
        Фотки шмоток с прозрачным фоном работают лучше всего.<br />
        Файлы хранятся локально — никуда не уходят.
      </p>
      <button class="empty-cta" type="button" onclick={() => (showUpload = true)}>
        <Plus size={20} strokeWidth={1.6} aria-hidden="true" />
        <span>Добавить</span>
      </button>
    </div>
  {:else if filtered.length === 0}
    <div class="empty subtle">
      <p class="empty-eyebrow">в этом слоте пусто</p>
      <p class="empty-hint">
        {#if filter === 'unclassified'}Все вещи разобраны.{:else}Загрузи что-нибудь в «{SLOT_LABEL_RU[filter as SlotKey]}».{/if}
      </p>
    </div>
  {:else}
    <ul class="grid" class:in-selection={inSelection}>
      {#each filtered as item (item.id)}
        {@const isSelected = selectedIds.has(item.id)}
        <li>
          <button
            class="tile"
            class:selected={isSelected}
            class:unslot={item.slot === null}
            type="button"
            onpointerdown={(e) => onTilePointerDown(item, e)}
            onpointermove={onTilePointerMove}
            onpointerup={onTilePointerUp}
            onpointercancel={onTilePointerUp}
            onclick={() => onTileClick(item)}
          >
            <div class="tile-photo">
              <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} />
              {#if isSelected}
                <span class="check" aria-hidden="true">✓</span>
              {/if}
            </div>
            <p class="tile-name" title={item.name}>{item.name}</p>
            <p class="tile-meta">{item.slot ? SLOT_LABEL_RU[item.slot] : 'без слота'}</p>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if !inSelection}
    <button class="fab" type="button" aria-label="Добавить" onclick={() => (showUpload = true)}>
      <Plus size={26} strokeWidth={1.6} aria-hidden="true" />
    </button>
  {/if}

  {#if undoVisible && lastAction}
    <div class="toast" role="status">
      <span>
        Перемещено {lastAction.count} {plural(lastAction.count, OUTFITS)} →
        {lastAction.targetSlot ? SLOT_LABEL_RU[lastAction.targetSlot] : 'без слота'}
      </span>
      <button class="toast-action" type="button" onclick={undo}>Отменить</button>
    </div>
  {/if}

  {#if showUpload}
    <UploadSheet onClose={() => (showUpload = false)} />
  {/if}

  {#if detailItem}
    <ItemDetail item={detailItem} onClose={() => (detailItem = null)} />
  {/if}

  {#if triageOpen}
    <Triage onClose={() => (triageOpen = false)} />
  {/if}
</section>

<style>
  .page {
    --hero-pad: var(--space-md);
    padding: var(--space-md) var(--hero-pad);
    padding-bottom: var(--space-3xl);
    max-width: var(--content-max);
    margin: 0 auto;
    position: relative;
  }

  .hero {
    margin-bottom: var(--space-md);
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2xs);
    margin-bottom: var(--space-md);
  }
  .title-strong {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--text);
    line-height: 1;
    letter-spacing: var(--track-tight);
  }
  .title-count {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    color: var(--text-muted);
    line-height: 1;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3xs);
  }
  .filter {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-3xs);
    padding: var(--space-3xs) var(--space-xs);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-soft);
    color: var(--text-soft);
    font-size: var(--text-sm);
    transition: all var(--dur-quick) var(--ease-out);
    background: transparent;
  }
  .filter:hover {
    color: var(--text);
    border-color: var(--border);
  }
  .filter.active {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .filter-warn {
    color: var(--accent);
    border-color: var(--accent);
  }
  .filter-warn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-on);
  }
  .filter-count {
    font-size: var(--text-xs);
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .triage-bar {
    margin-top: var(--space-sm);
  }
  .triage-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--accent);
    color: var(--accent-on);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .triage-btn:hover {
    background: var(--accent-hover);
  }
  .triage-label {
    font-size: var(--text-lg);
    line-height: 1;
    letter-spacing: var(--track-tight);
  }
  .triage-count {
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
    background: oklch(0 0 0 / 0.18);
    padding: 2px var(--space-2xs);
    border-radius: var(--radius-pill);
  }

  /* ─── selection bar ─── */
  .hero-select {
    background: var(--surface);
    margin: calc(-1 * var(--space-md)) calc(-1 * var(--hero-pad)) var(--space-md);
    padding: var(--space-sm) var(--hero-pad);
    border-bottom: 1px solid var(--border-soft);
  }
  .select-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-2xs);
  }
  .icon-btn {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out);
  }
  .icon-btn:hover {
    color: var(--text);
    background: var(--surface-2);
  }
  .select-count {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: var(--space-3xs);
  }
  .select-count-n {
    font-size: var(--text-2xl);
    line-height: 1;
    color: var(--text);
  }
  .select-count-label {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .ghost {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding: var(--space-2xs) var(--space-2xs);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out);
  }
  .ghost:hover {
    color: var(--text);
  }
  .select-hint {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-2xs);
  }
  .drop-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3xs);
  }
  .drop-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    padding: var(--space-2xs) var(--space-xs);
    background: var(--accent-tint);
    border: 1px solid var(--accent);
    color: var(--text);
    border-radius: var(--radius-pill);
    font-size: var(--text-sm);
    font-weight: var(--w-medium);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .drop-chip:hover {
    background: var(--accent);
    color: var(--accent-on);
  }

  /* ─── grid ─── */
  .grid {
    display: grid;
    gap: var(--space-xs);
    grid-template-columns: repeat(3, 1fr);
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
    background: transparent;
    border-radius: var(--radius-2);
    overflow: hidden;
    transition: transform var(--dur-quick) var(--ease-out);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .tile:hover:not(.selected) {
    transform: translateY(-2px);
  }
  .tile-photo {
    background: var(--tile);
    aspect-ratio: 1;
    padding: 8%;
    margin-bottom: var(--space-2xs);
    border-radius: var(--radius-2);
    position: relative;
    transition: filter var(--dur-quick) var(--ease-out), outline var(--dur-quick) var(--ease-out);
    outline: 2px solid transparent;
    outline-offset: -2px;
  }
  .tile.selected .tile-photo {
    outline-color: var(--accent);
  }
  .tile.unslot .tile-photo::before {
    content: '';
    position: absolute;
    top: 6px;
    left: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
  }
  .tile:hover .tile-photo {
    filter: brightness(0.97);
  }
  .check {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-on);
    display: grid;
    place-items: center;
    font-size: 13px;
    font-weight: 700;
  }
  .tile-name {
    font-size: var(--text-sm);
    color: var(--text);
    line-height: var(--lh-snug);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-clamp: 1;
  }
  .tile-meta {
    font-size: var(--text-xs);
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Empty state */
  .empty {
    padding: var(--space-2xl) var(--space-md);
    text-align: left;
    max-width: 560px;
  }
  .empty.subtle {
    padding: var(--space-xl) var(--space-md);
    text-align: center;
    margin: 0 auto;
  }
  .empty-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: var(--space-sm);
  }
  .empty-title {
    font-size: var(--text-3xl);
    line-height: 1.05;
    color: var(--text);
    margin-bottom: var(--space-md);
  }
  .empty-title-accent {
    color: var(--accent);
  }
  .empty-hint {
    color: var(--text-muted);
    font-size: var(--text-md);
    margin-bottom: var(--space-lg);
    line-height: var(--lh-snug);
  }
  .empty-cta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-2);
    font-family: var(--font-display);
    font-size: var(--text-xl);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .empty-cta:hover {
    background: var(--accent-hover);
  }

  /* FAB */
  .fab {
    position: fixed;
    right: var(--space-md);
    bottom: calc(var(--nav-height-mobile) + var(--safe-bottom) + var(--space-md));
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--accent-on);
    display: grid;
    place-items: center;
    box-shadow: var(--shadow-elev-2);
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
    z-index: 40;
  }
  .fab:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  @media (min-width: 900px) {
    .fab {
      bottom: var(--space-lg);
      right: var(--space-lg);
    }
  }

  /* Undo toast */
  .toast {
    position: fixed;
    left: var(--space-sm);
    right: var(--space-sm);
    bottom: calc(var(--nav-height-mobile) + var(--safe-bottom) + var(--space-sm));
    background: var(--surface-3);
    color: var(--text);
    border: 1px solid var(--border);
    padding: var(--space-2xs) var(--space-sm);
    border-radius: var(--radius-2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-sm);
    box-shadow: var(--shadow-elev-2);
    z-index: 60;
    animation: toast-in var(--dur-base) var(--ease-out-expo);
  }
  .toast-action {
    color: var(--accent);
    font-weight: var(--w-medium);
    padding: var(--space-3xs) var(--space-2xs);
    border-radius: var(--radius-2);
  }
  @media (min-width: 900px) {
    .toast {
      left: calc(var(--nav-width-desktop) + var(--space-md));
      right: var(--space-md);
      bottom: var(--space-md);
      max-width: 480px;
    }
  }
  @keyframes toast-in {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast { animation: none; }
  }
</style>
