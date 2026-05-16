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
    onClose();
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
      <h2 class="sheet-title">Вещь</h2>
      <button class="icon-btn" type="button" aria-label="Закрыть" onclick={onClose}>
        <X size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </header>

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

      <div class="danger-zone">
        <button class="destructive" type="button" onclick={askDelete}>
          <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>Удалить вещь</span>
        </button>
      </div>
    </div>
  </div>

  {#if confirmDelete}
    <div class="confirm" role="alertdialog">
      <div class="confirm-card">
        <p class="confirm-text">
          {#if outfitsUsing > 0}
            Удалить «{item.name}»? Эта вещь в <strong>{outfitsUsing}</strong>
            {outfitsUsing === 1 ? 'образе' : outfitsUsing < 5 ? 'образах' : 'образах'}.
          {:else}
            Удалить «{item.name}»?
          {/if}
        </p>
        <div class="confirm-actions">
          <button type="button" class="ghost" onclick={() => (confirmDelete = false)}>Отмена</button>
          <button type="button" class="destructive-solid" onclick={doDelete}>Удалить</button>
        </div>
      </div>
    </div>
  {/if}
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
    max-width: 560px;
    border-top: 1px solid var(--border);
    border-radius: var(--radius-2) var(--radius-2) 0 0;
    padding: var(--space-md);
    padding-bottom: calc(var(--space-md) + var(--safe-bottom));
    max-height: 92dvh;
    overflow-y: auto;
    animation: slide-up var(--dur-medium) var(--ease-out-expo);
  }

  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-md);
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
    transition: color var(--dur-quick) var(--ease-out);
  }
  .icon-btn:hover {
    color: var(--text);
  }

  .preview {
    background: var(--tile);
    border: 1px solid var(--border-soft);
    aspect-ratio: 4 / 5;
    padding: var(--space-md);
    margin-bottom: var(--space-md);
    border-radius: var(--radius-2);
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

  .danger-zone {
    margin-top: var(--space-md);
    padding-top: var(--space-md);
    border-top: 1px solid var(--border-soft);
  }
  .destructive {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    color: var(--accent);
    padding: var(--space-2xs) 0;
    transition: opacity var(--dur-quick) var(--ease-out);
  }
  .destructive:hover {
    opacity: 0.8;
  }

  .confirm {
    position: fixed;
    inset: 0;
    background: var(--scrim-strong);
    display: grid;
    place-items: center;
    z-index: 300;
    padding: var(--space-md);
  }
  .confirm-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-2);
    padding: var(--space-md);
    max-width: 380px;
    width: 100%;
  }
  .confirm-text {
    font-size: var(--text-lg);
    color: var(--text);
    margin-bottom: var(--space-md);
    line-height: var(--lh-snug);
  }
  .confirm-actions {
    display: flex;
    gap: var(--space-2xs);
    justify-content: flex-end;
  }
  .ghost {
    padding: var(--space-2xs) var(--space-sm);
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out);
  }
  .ghost:hover {
    color: var(--text);
  }
  .destructive-solid {
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-2xs) var(--space-sm);
    border-radius: var(--radius-2);
    font-weight: var(--w-medium);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .destructive-solid:hover {
    background: var(--accent-hover);
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .overlay, .sheet { animation: none; }
  }
</style>
