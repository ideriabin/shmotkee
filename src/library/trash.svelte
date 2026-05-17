<script lang="ts">
  /*
   * Trash view — soft-deleted items live here until restored or purged.
   *
   * Each tile shows the item thumbnail with two inline actions: восстановить
   * (clears deletedAt → item reappears in library) and удалить навсегда
   * (purgeItem → drops the row + cascades through saved outfits).
   *
   * "Очистить корзину" in the header is the bulk purge. There's no
   * confirmation on individual purge clicks because the per-item action
   * is already a deliberate two-step (delete from library → open trash →
   * tap purge); a global "are you sure" only gates the bulk case.
   */
  import { X, RotateCcw, Trash2, ShieldAlert } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item } from '../shared/types';
  import { restoreItem, purgeItem, purgeAllDeleted } from '../db/items';
  import Thumb from './thumb.svelte';

  let { onClose }: { onClose: () => void } = $props();

  let items = $state<Item[]>([]);
  let confirmEmpty = $state(false);
  let working = $state(false);

  $effect(() => {
    const obs = liveQuery(() =>
      db.items
        .filter((it) => !!it.deletedAt)
        .toArray()
        .then((arr) => arr.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))),
    );
    const sub = obs.subscribe({ next: (v) => (items = v) });
    return () => sub.unsubscribe();
  });

  async function doRestore(id: string) {
    if (working) return;
    working = true;
    try {
      await restoreItem(id);
    } finally {
      working = false;
    }
  }

  async function doPurge(id: string) {
    if (working) return;
    working = true;
    try {
      await purgeItem(id);
    } finally {
      working = false;
    }
  }

  async function emptyTrash() {
    if (working) return;
    working = true;
    try {
      await purgeAllDeleted();
      confirmEmpty = false;
    } finally {
      working = false;
    }
  }

  let closing = $state(false);
  function requestClose() {
    if (closing) return;
    closing = true;
    setTimeout(onClose, 220);
  }
</script>

<div class="trash" class:closing role="dialog" aria-modal="true">
  <header class="top-bar">
    <button class="icon-btn" type="button" aria-label="Закрыть" onclick={requestClose}>
      <X size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <h2 class="top-title">Корзина</h2>
    {#if items.length > 0}
      <button
        class="icon-btn icon-btn-destructive"
        type="button"
        aria-label="Очистить корзину"
        onclick={() => (confirmEmpty = true)}
      >
        <ShieldAlert size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
    {:else}
      <span class="top-spacer"></span>
    {/if}
  </header>

  {#if items.length === 0}
    <div class="empty">
      <p class="empty-eyebrow">пусто</p>
      <p class="empty-title">
        <span class="display">Корзина чиста.</span>
      </p>
      <p class="empty-hint">
        Сюда попадают вещи, удалённые из гардероба. Их можно вернуть или удалить навсегда.
      </p>
    </div>
  {:else}
    <ul class="grid">
      {#each items as item (item.id)}
        <li>
          <div class="tile">
            <div class="tile-photo">
              <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} fit="contain" />
            </div>
            <p class="tile-name">{item.name}</p>
            <div class="tile-actions">
              <button
                class="action restore"
                type="button"
                disabled={working}
                onclick={() => doRestore(item.id)}
              >
                <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>Вернуть</span>
              </button>
              <button
                class="action purge"
                type="button"
                disabled={working}
                onclick={() => doPurge(item.id)}
              >
                <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>Совсем</span>
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if confirmEmpty}
    <div
      class="action-overlay"
      role="alertdialog"
      aria-modal="true"
      tabindex="-1"
      onclick={(e) => {
        if (e.target === e.currentTarget) confirmEmpty = false;
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') confirmEmpty = false;
      }}
    >
      <div class="action-sheet">
        <p class="action-text">
          Удалить навсегда <strong>{items.length}</strong>? Эти вещи также пропадут из сохранённых образов.
        </p>
        <button type="button" class="action-destructive" disabled={working} onclick={emptyTrash}>
          Удалить навсегда
        </button>
      </div>
      <button type="button" class="action-cancel" onclick={() => (confirmEmpty = false)}>
        Отмена
      </button>
    </div>
  {/if}
</div>

<style>
  .trash {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    z-index: 200;
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
    animation: trash-in var(--dur-medium) var(--ease-out-expo);
  }
  .trash.closing {
    animation: trash-out var(--dur-base) var(--ease-out) forwards;
  }
  @keyframes trash-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes trash-out {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(8px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .trash, .trash.closing { animation: none; }
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
    transition:
      color var(--dur-quick) var(--ease-out),
      background var(--dur-quick) var(--ease-out),
      transform var(--dur-quick) var(--ease-out);
  }
  .icon-btn-destructive {
    color: var(--accent);
  }
  @media (hover: hover) {
    .icon-btn:hover { color: var(--text); background: var(--surface); }
    .icon-btn-destructive:hover { color: var(--accent); }
  }
  .icon-btn:active {
    transform: scale(0.9);
    background: var(--surface);
    transition-duration: 60ms;
  }

  .grid {
    display: grid;
    gap: var(--space-sm);
    grid-template-columns: repeat(2, 1fr);
    overflow-y: auto;
    overscroll-behavior-y: contain;
    flex: 1;
    min-height: 0;
    padding: var(--space-sm) var(--space-md);
    -webkit-overflow-scrolling: touch;
  }
  @media (min-width: 600px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 900px) {
    .grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (min-width: 1200px) {
    .grid { grid-template-columns: repeat(5, 1fr); }
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
  }
  .tile-photo {
    background: var(--tile);
    aspect-ratio: 1;
    padding: 8%;
    border-radius: var(--radius-3);
    /* Soft desaturation so trashed items read as "inactive" without
       being unrecognizable. */
    filter: saturate(0.75);
    opacity: 0.85;
  }
  .tile-name {
    font-size: var(--text-sm);
    color: var(--text-muted);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-clamp: 1;
  }
  .tile-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3xs);
  }
  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3xs);
    padding: var(--space-2xs) var(--space-xs);
    border-radius: var(--radius-2);
    border: 1px solid var(--border-soft);
    background: transparent;
    color: var(--text);
    font-size: var(--text-sm);
    transition: background var(--dur-quick) var(--ease-out), color var(--dur-quick) var(--ease-out), border-color var(--dur-quick) var(--ease-out);
  }
  .action:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .action.restore:hover:not(:disabled),
  .action.restore:active:not(:disabled) {
    background: var(--surface-2);
    border-color: var(--border);
  }
  .action.purge {
    color: var(--text-muted);
  }
  .action.purge:hover:not(:disabled),
  .action.purge:active:not(:disabled) {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-on);
  }

  .empty {
    padding: var(--space-2xl) var(--space-md);
    text-align: center;
    max-width: 480px;
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
    color: var(--text);
    line-height: 1.05;
    margin-bottom: var(--space-md);
  }
  .empty-hint {
    color: var(--text-muted);
    line-height: var(--lh-snug);
  }
</style>
