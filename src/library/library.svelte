<script lang="ts">
  import { Plus, X, ListChecks, CheckCheck, MoveRight, Trash2, CircleDashed } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item } from '../shared/types';
  import {
    SLOT_KEYS,
    SLOT_LABEL_RU,
    type SlotKey,
  } from '../shared/slots';
  import { plural, OUTFITS, ITEMS } from '../shared/ru-plural';
  import { updateItemSlots, snapshotSlots, restoreItemSlots, deleteItem } from '../db/items';
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
    kind: 'move' | 'delete';
    snapshot: Map<string, SlotKey | null>;
    deletedItems?: Item[];
    targetSlot: SlotKey | null;
    count: number;
  } | null>(null);
  let undoVisible = $state(false);
  let undoTimer: number | undefined;

  // Bulk-delete confirmation
  let confirmDeleteCount = $state(0);
  let showDeleteConfirm = $state(false);

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
  async function batchAssign(slot: SlotKey | null) {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const snapshot = await snapshotSlots(ids);
    await updateItemSlots(ids, slot);
    lastAction = { kind: 'move', snapshot, targetSlot: slot, count: ids.length };
    showUndo();
    clearSelection();
  }

  function askBatchDelete() {
    if (selectedIds.size === 0) return;
    confirmDeleteCount = selectedIds.size;
    showDeleteConfirm = true;
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    // Cascading deletes also drop the items from saved outfits — those
    // can't be undone via the toast.
    for (const id of ids) await deleteItem(id);
    showDeleteConfirm = false;
    confirmDeleteCount = 0;
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
  <header class="hero">
    <div class="title-row">
      {#if inSelection}
        <button class="title-icon-btn" type="button" aria-label="Отмена" onclick={exitSelectionMode}>
          <X size={22} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <h1 class="title title-select">
          <span class="display title-strong">{selectedIds.size}</span>
          <span class="title-meta">выбрано</span>
        </h1>
        <button class="title-icon-btn" type="button" aria-label="Выбрать все" onclick={selectAllVisible}>
          <CheckCheck size={20} strokeWidth={1.6} aria-hidden="true" />
        </button>
      {:else}
        <h1 class="title">
          <span class="display title-strong">Гардероб</span>
          <span class="title-count">{items.length}</span>
        </h1>
      {/if}
    </div>

    <div class="chip-strip" role={inSelection ? 'toolbar' : 'tablist'}>
      {#if inSelection}
        {#each SLOT_KEYS as slot (slot)}
          <button class="chip chip-drop" type="button" onclick={() => batchAssign(slot)}>
            <MoveRight size={12} strokeWidth={1.8} aria-hidden="true" />
            <span>{SLOT_LABEL_RU[slot]}</span>
          </button>
        {/each}
        <button class="chip chip-drop chip-drop-soft" type="button" onclick={() => batchAssign(null)}>
          <CircleDashed size={12} strokeWidth={1.8} aria-hidden="true" />
          <span>Без слота</span>
        </button>
        <button class="chip chip-destructive" type="button" onclick={askBatchDelete}>
          <Trash2 size={12} strokeWidth={1.8} aria-hidden="true" />
          <span>Удалить</span>
        </button>
      {:else}
        {#if slotCounts.unclassified > 0}
          <button
            role="tab"
            type="button"
            class="chip chip-filter chip-warn"
            class:active={filter === 'unclassified'}
            aria-selected={filter === 'unclassified'}
            onclick={() => setFilter('unclassified')}
          >
            Без слота
            <span class="chip-count">{slotCounts.unclassified}</span>
          </button>
        {/if}
        <button
          role="tab"
          type="button"
          class="chip chip-filter"
          class:active={filter === 'all'}
          aria-selected={filter === 'all'}
          onclick={() => setFilter('all')}
        >
          Все
          <span class="chip-count">{slotCounts.all}</span>
        </button>
        {#each SLOT_KEYS as slot (slot)}
          <button
            role="tab"
            type="button"
            class="chip chip-filter"
            class:active={filter === slot}
            aria-selected={filter === slot}
            onclick={() => setFilter(slot)}
          >
            {SLOT_LABEL_RU[slot]}
            <span class="chip-count">{slotCounts[slot] ?? 0}</span>
          </button>
        {/each}
      {/if}
    </div>

    {#if !inSelection && filter === 'unclassified' && slotCounts.unclassified > 0}
      <div class="triage-bar">
        <button class="triage-btn" type="button" onclick={() => (triageOpen = true)}>
          <ListChecks size={18} strokeWidth={1.6} aria-hidden="true" />
          <span class="display triage-label">Разобрать по одному</span>
          <span class="triage-count">{slotCounts.unclassified}</span>
        </button>
      </div>
    {/if}
  </header>

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
        Перемещено {lastAction.count} {plural(lastAction.count, ITEMS)} →
        {lastAction.targetSlot ? SLOT_LABEL_RU[lastAction.targetSlot] : 'без слота'}
      </span>
      <button class="toast-action" type="button" onclick={undo}>Отменить</button>
    </div>
  {/if}

  {#if showUpload}
    <UploadSheet
      onClose={() => (showUpload = false)}
      defaultSlot={filter === 'all' || filter === 'unclassified' ? null : filter}
    />
  {/if}

  {#if detailItem}
    <ItemDetail item={detailItem} onClose={() => (detailItem = null)} />
  {/if}

  {#if triageOpen}
    <Triage onClose={() => (triageOpen = false)} />
  {/if}

  {#if showDeleteConfirm}
    <div class="modal" role="alertdialog">
      <div class="modal-card">
        <p class="modal-title display">Удалить {confirmDeleteCount} {plural(confirmDeleteCount, ITEMS)}?</p>
        <p class="modal-hint">Действие нельзя отменить. Эти вещи также пропадут из всех сохранённых образов.</p>
        <div class="modal-actions">
          <button type="button" class="modal-ghost" onclick={() => (showDeleteConfirm = false)}>отмена</button>
          <button type="button" class="modal-destructive" onclick={batchDelete}>удалить</button>
        </div>
      </div>
    </div>
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
    margin-bottom: var(--space-sm);
  }

  /* Title row stays the same height between idle and selection mode so
     the page below doesn't jump when entering/leaving selection. */
  .title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    min-height: 40px;
    margin-bottom: var(--space-2xs);
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2xs);
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  .title-select {
    /* Bigger gap between count and label */
    gap: var(--space-3xs);
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
  .title-meta {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .title-icon-btn {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    flex-shrink: 0;
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out);
  }
  .title-icon-btn:hover, .title-icon-btn:active {
    color: var(--text);
    background: var(--surface);
  }

  /* ─── unified chip strip ─── horizontal scrolling, single line.
     Hosts filter chips in idle mode and drop-target/destructive chips
     in selection mode. Same DOM slot → no layout shift. */
  .chip-strip {
    display: flex;
    gap: var(--space-3xs);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: var(--space-3xs) 0;
    /* let the scroll bleed to the page edges so chips don't look
       cramped against the padding */
    margin: 0 calc(-1 * var(--hero-pad));
    padding-left: var(--hero-pad);
    padding-right: var(--hero-pad);
    scroll-padding-inline: var(--hero-pad);
    -webkit-overflow-scrolling: touch;
  }
  .chip-strip::-webkit-scrollbar {
    display: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    padding: var(--space-2xs) var(--space-sm);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-soft);
    color: var(--text-soft);
    background: transparent;
    font-size: var(--text-sm);
    line-height: 1.2;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all var(--dur-quick) var(--ease-out);
    -webkit-tap-highlight-color: transparent;
  }
  .chip:hover, .chip:active {
    color: var(--text);
    border-color: var(--border);
  }

  .chip-filter.active {
    background: var(--text);
    border-color: var(--text);
    color: var(--bg);
  }
  .chip-warn {
    color: var(--accent);
    border-color: var(--accent);
  }
  .chip-warn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-on);
  }
  .chip-count {
    font-size: var(--text-xs);
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .chip-drop {
    background: var(--accent-tint);
    border-color: var(--accent);
    color: var(--text);
    font-weight: var(--w-medium);
    font-size: var(--text-md);
  }
  .chip-drop:hover, .chip-drop:active {
    background: var(--accent);
    color: var(--accent-on);
  }
  .chip-drop-soft {
    background: transparent;
    border-color: var(--border);
    color: var(--text-muted);
  }
  .chip-drop-soft:hover, .chip-drop-soft:active {
    background: var(--surface-2);
    color: var(--text);
    border-color: var(--border);
  }
  .chip-destructive {
    background: transparent;
    border-color: var(--border);
    color: var(--text-muted);
    font-weight: var(--w-medium);
    font-size: var(--text-md);
  }
  .chip-destructive:hover, .chip-destructive:active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-on);
  }

  .triage-bar {
    margin-top: var(--space-2xs);
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
  @media (hover: hover) {
    .tile:hover:not(.selected) {
      transform: translateY(-2px);
    }
  }
  .tile:active:not(.selected) {
    transform: scale(0.97);
    transition-duration: 60ms;
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
  /* Prevent iOS Safari's native "long-press to save/copy/preview"
     gesture on the photo — we want long-press to enter selection mode,
     not show a system menu. */
  .tile-photo :global(img) {
    pointer-events: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
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
  @media (hover: hover) {
    .tile:hover .tile-photo {
      filter: brightness(0.97);
    }
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
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .empty-cta:hover { background: var(--accent-hover); }
  }
  .empty-cta:active {
    background: var(--accent-hover);
    transform: scale(0.97);
    transition-duration: 60ms;
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
  @media (hover: hover) {
    .fab:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }
  }
  .fab:active {
    transform: scale(0.92);
    transition-duration: 60ms;
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

  /* Bulk-delete confirm modal */
  .modal {
    position: fixed;
    inset: 0;
    background: var(--scrim-strong);
    display: grid;
    place-items: center;
    padding: var(--space-md);
    z-index: 400;
  }
  .modal-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-2);
    padding: var(--space-md);
    max-width: 380px;
    width: 100%;
  }
  .modal-title {
    font-size: var(--text-2xl);
    color: var(--text);
    line-height: 1.1;
    margin-bottom: var(--space-2xs);
  }
  .modal-hint {
    color: var(--text-muted);
    font-size: var(--text-sm);
    line-height: var(--lh-snug);
    margin-bottom: var(--space-md);
  }
  .modal-actions {
    display: flex;
    gap: var(--space-2xs);
    justify-content: flex-end;
  }
  .modal-ghost {
    padding: var(--space-2xs) var(--space-sm);
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .modal-ghost:hover { color: var(--text); }
  }
  .modal-ghost:active {
    color: var(--text);
    transform: scale(0.96);
    transition-duration: 60ms;
  }
  .modal-destructive {
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-2xs) var(--space-sm);
    border-radius: var(--radius-2);
    font-weight: var(--w-medium);
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .modal-destructive:hover { background: var(--accent-hover); }
  }
  .modal-destructive:active {
    background: var(--accent-hover);
    transform: scale(0.96);
    transition-duration: 60ms;
  }
</style>
