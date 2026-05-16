<script lang="ts">
  import { X, Trash2, Minus, Plus } from 'lucide-svelte';
  import type { Item } from '../shared/types';
  import { SLOT_KEYS, SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
  import { updateItem, deleteItem, countOutfitsUsing } from '../db/items';
  import Thumb from './thumb.svelte';

  let { item, onClose }: { item: Item; onClose: () => void } = $props();

  let name = $state(item.name);
  let slot = $state<SlotKey | null>(item.slot);
  let zPriority = $state(item.zPriority);
  let confirmDelete = $state(false);
  let outfitsUsing = $state(0);

  // Exit animation: defer the parent's onClose() until the slide-down
  // finishes so the sheet doesn't just blink out.
  let closing = $state(false);
  function requestClose() {
    if (closing) return;
    closing = true;
    setTimeout(onClose, 220);
  }

  // Debounce name save: 400ms after last keystroke.
  let saveNameTimer: number | undefined;
  $effect(() => {
    const next = name.trim();
    if (next === item.name) return;
    if (saveNameTimer) window.clearTimeout(saveNameTimer);
    saveNameTimer = window.setTimeout(() => {
      updateItem(item.id, { name: next || 'Без имени' });
    }, 400);
  });

  $effect(() => {
    if (slot !== item.slot) {
      updateItem(item.id, { slot });
    }
  });

  $effect(() => {
    if (zPriority !== item.zPriority) {
      updateItem(item.id, { zPriority });
    }
  });

  async function askDelete() {
    outfitsUsing = await countOutfitsUsing(item.id);
    confirmDelete = true;
  }

  async function doDelete() {
    await deleteItem(item.id);
    requestClose();
  }
</script>

<div class="detail" class:closing role="dialog" aria-modal="true">
  <header class="top-bar">
    <button class="icon-btn" type="button" aria-label="Закрыть" onclick={requestClose}>
      <X size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <h2 class="top-title">Вещь</h2>
    <button class="icon-btn" type="button" aria-label="Удалить" onclick={askDelete}>
      <Trash2 size={20} strokeWidth={1.5} aria-hidden="true" />
    </button>
  </header>

  <div class="body">
    <div class="preview">
      <Thumb blob={item.blob} alt={item.name} />
    </div>

    <div class="form">
      <label class="field">
        <span class="label">Название</span>
        <input class="input" type="text" bind:value={name} maxlength="80" />
      </label>

      <fieldset class="field">
        <legend class="label">Слот</legend>
        <div class="chips">
          <button
            type="button"
            class="chip"
            class:active={slot === null}
            onclick={() => (slot = null)}
          >
            Без слота
          </button>
          {#each SLOT_KEYS as key (key)}
            <button
              type="button"
              class="chip"
              class:active={slot === key}
              onclick={() => (slot = key)}
            >
              {SLOT_LABEL_RU[key]}
            </button>
          {/each}
        </div>
      </fieldset>

      <div class="field">
        <span class="label">Порядок слоёв</span>
        <div class="stepper">
          <button class="step" type="button" aria-label="Меньше" onclick={() => (zPriority = Math.max(-9, zPriority - 1))}>
            <Minus size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <span class="z-value">{zPriority}</span>
          <button class="step" type="button" aria-label="Больше" onclick={() => (zPriority = Math.min(9, zPriority + 1))}>
            <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <span class="z-hint">меньше — назад · больше — наперёд</span>
        </div>
      </div>
    </div>
  </div>

  {#if confirmDelete}
    <div
      class="action-overlay"
      role="alertdialog"
      onclick={(e) => {
        if (e.target === e.currentTarget) confirmDelete = false;
      }}
    >
      <div class="action-sheet">
        <p class="action-text">
          {#if outfitsUsing > 0}
            Удалить «{item.name}»? Эта вещь в <strong>{outfitsUsing}</strong>
            {outfitsUsing === 1 ? 'образе' : outfitsUsing < 5 ? 'образах' : 'образах'}.
          {:else}
            Удалить «{item.name}»?
          {/if}
        </p>
        <button type="button" class="action-destructive" onclick={doDelete}>Удалить</button>
      </div>
      <button type="button" class="action-cancel" onclick={() => (confirmDelete = false)}>
        Отмена
      </button>
    </div>
  {/if}
</div>

<style>
  /* Fullscreen view — same pattern as triage/tinder. No scrolling
     unless the form is taller than viewport (rare). Photo + form lay
     out at native scale instead of inside a scrolling sheet. */
  .detail {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    z-index: 200;
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
    animation: detail-in var(--dur-medium) var(--ease-out-expo);
  }
  .detail.closing {
    animation: detail-out var(--dur-base) var(--ease-out) forwards;
  }
  @keyframes detail-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes detail-out {
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
    .icon-btn:hover {
      color: var(--text);
      background: var(--surface);
    }
  }
  .icon-btn:active {
    transform: scale(0.9);
    background: var(--surface);
    color: var(--text);
    transition-duration: 60ms;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    padding: var(--space-md);
    max-width: 600px;
    width: 100%;
    margin: 0 auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Photo claims the upper portion but is bounded so the form is
     always at least partially visible at first sight on phone.
     aspect-ratio with max-height auto-resolves width — the box
     never exceeds 40dvh tall AND keeps a 4:5 portrait silhouette. */
  .preview {
    background: var(--tile);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-2);
    aspect-ratio: 4 / 5;
    max-height: 40dvh;
    max-width: 100%;
    padding: var(--space-md);
    margin: 0 auto var(--space-md);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2xs);
    border: none;
    padding: 0;
  }

  .label {
    font-size: var(--text-xs);
    font-weight: var(--w-medium);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .input {
    background: var(--surface-2);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-2);
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--text-lg);
    color: var(--text);
    width: 100%;
    transition: border-color var(--dur-quick) var(--ease-out);
  }
  .input:focus {
    border-color: var(--accent);
    outline: none;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3xs);
  }
  .chip {
    padding: var(--space-3xs) var(--space-xs);
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-soft);
    color: var(--text-soft);
    font-size: var(--text-sm);
    transition: all var(--dur-quick) var(--ease-out);
    background: transparent;
  }
  .chip:hover {
    color: var(--text);
    border-color: var(--border);
  }
  .chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-on);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .step {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .step:hover {
    background: var(--surface-3);
  }
  .z-value {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    min-width: 2ch;
    text-align: center;
  }
  .z-hint {
    margin-left: var(--space-2xs);
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  /* Action-sheet styles live in global.css. */

  @media (prefers-reduced-motion: reduce) {
    .detail, .detail.closing { animation: none; }
  }
</style>
