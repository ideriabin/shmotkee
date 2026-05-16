<script lang="ts">
  import { ChevronLeft, Download, Trash2, X } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Session, SavedOutfit, Item, Combination } from '../shared/types';
  import { SLOT_KEYS, type SlotKey, SLOT_LABEL_RU } from '../shared/slots';
  import { plural, OUTFITS } from '../shared/ru-plural';
  import { listOutfitsForSession, deleteOutfit } from '../db/outfits';
  import { deleteSession, renameSession } from '../db/sessions';
  import { renderOutfitToPng } from '../export/canvas-renderer';
  import { downloadBlob, downloadAsZip } from '../export/download';
  import { slugify } from '../export/slug';
  import Preview from '../compose/preview.svelte';

  let {
    session,
    onBack,
    onDeleted,
  }: { session: Session; onBack: () => void; onDeleted: () => void } = $props();

  let outfits = $state<SavedOutfit[]>([]);
  let library = $state<Item[]>([]);
  let editingName = $state(false);
  let nameDraft = $state('');
  let exporting = $state(false);
  let exportProgress = $state(0);
  let exportTotal = $state(0);
  let showPostExport = $state(false);
  let showDeleteConfirm = $state(false);

  $effect(() => {
    const obs = liveQuery(() => listOutfitsForSession(session.id));
    const sub = obs.subscribe({ next: (v) => (outfits = v) });
    return () => sub.unsubscribe();
  });

  $effect(() => {
    const obs = liveQuery(() => db.items.toArray());
    const sub = obs.subscribe({ next: (v) => (library = v) });
    return () => sub.unsubscribe();
  });

  const itemsById = $derived(new Map(library.map((it) => [it.id, it])));

  function outfitToCombination(o: SavedOutfit): Combination {
    const bySlot: Record<SlotKey, Item[]> = {
      bottom: [],
      full_body: [],
      top: [],
      outerwear: [],
      shoes: [],
      accessories: [],
      other: [],
    };
    for (const id of o.itemIds) {
      const it = itemsById.get(id);
      if (it && it.slot !== null) bySlot[it.slot].push(it);
    }
    return { bySlot, key: o.id };
  }

  function outfitCaption(o: SavedOutfit): string {
    const parts: string[] = [];
    for (const slot of SLOT_KEYS) {
      const items = o.itemIds
        .map((id) => itemsById.get(id))
        .filter((it): it is Item => !!it && it.slot === slot);
      if (items.length === 0) continue;
      parts.push(`${SLOT_LABEL_RU[slot]}: ${items.map((i) => i.name).join(' · ')}`);
    }
    return parts.join('  ·  ');
  }

  function startEditName() {
    nameDraft = session.name;
    editingName = true;
  }
  async function commitName() {
    editingName = false;
    const next = nameDraft.trim() || session.name;
    if (next !== session.name) {
      await renameSession(session.id, next);
      // Mutate the prop locally for immediate feedback;
      // liveQuery in the parent will catch up.
      session.name = next;
    }
  }

  async function removeOutfit(id: string) {
    await deleteOutfit(id);
  }

  function pad(n: number, width = 3): string {
    return String(n).padStart(width, '0');
  }

  async function exportOne(o: SavedOutfit, index: number) {
    const combo = outfitToCombination(o);
    const blob = await renderOutfitToPng(combo);
    const filename = `${slugify(session.name)}_${pad(index + 1)}.png`;
    downloadBlob(blob, filename);
  }

  async function exportAll() {
    exporting = true;
    exportProgress = 0;
    exportTotal = outfits.length;
    const files: { name: string; blob: Blob }[] = [];
    // Render in reverse so the zip ordering matches creation order.
    const ordered = [...outfits].reverse();
    for (let i = 0; i < ordered.length; i++) {
      const o = ordered[i]!;
      const combo = outfitToCombination(o);
      const blob = await renderOutfitToPng(combo);
      files.push({ name: `${slugify(session.name)}_${pad(i + 1)}.png`, blob });
      exportProgress = i + 1;
    }
    if (files.length === 1) {
      downloadBlob(files[0]!.blob, files[0]!.name);
    } else {
      await downloadAsZip(files, `${slugify(session.name)}.zip`);
    }
    exporting = false;
    showPostExport = true;
  }

  async function deleteThisSession() {
    await deleteSession(session.id);
    onDeleted();
  }
</script>

<section class="detail">
  <header class="head">
    <button class="icon-btn" type="button" aria-label="Назад" onclick={onBack}>
      <ChevronLeft size={22} strokeWidth={1.6} aria-hidden="true" />
    </button>
    <div class="head-title">
      <span class="head-eyebrow">сессия</span>
      {#if editingName}
        <input
          class="head-input"
          autofocus
          bind:value={nameDraft}
          onblur={commitName}
          onkeydown={(e) => { if (e.key === 'Enter') commitName(); }}
        />
      {:else}
        <button class="head-name" type="button" onclick={startEditName}>
          {session.name}
        </button>
      {/if}
      <p class="head-count">{outfits.length} {plural(outfits.length, OUTFITS)}</p>
    </div>
    <button class="icon-btn destructive" type="button" aria-label="Удалить сессию" onclick={() => (showDeleteConfirm = true)}>
      <Trash2 size={20} strokeWidth={1.6} aria-hidden="true" />
    </button>
  </header>

  {#if outfits.length === 0}
    <div class="empty">
      <p class="empty-eyebrow">пусто</p>
      <p class="empty-title">
        <span class="display">Ничего не сохранено</span>
        <br />
        <span class="display empty-accent">в этой сессии.</span>
      </p>
    </div>
  {:else}
    <ul class="outfit-list">
      {#each outfits as o (o.id)}
        <li class="outfit">
          <div class="outfit-preview">
            <Preview combo={outfitToCombination(o)} accent />
          </div>
          <div class="outfit-meta">
            <p class="outfit-caption">{outfitCaption(o)}</p>
            <div class="outfit-actions">
              <button class="outfit-action" type="button" onclick={() => exportOne(o, outfits.indexOf(o))}>
                <Download size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>скачать</span>
              </button>
              <button class="outfit-action destructive" type="button" onclick={() => removeOutfit(o.id)}>
                <X size={14} strokeWidth={1.6} aria-hidden="true" />
                <span>удалить</span>
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>

    <div class="export-bar">
      <button class="export-btn" type="button" disabled={exporting} onclick={exportAll}>
        <Download size={20} strokeWidth={1.6} aria-hidden="true" />
        <span class="export-label display">Скачать все</span>
      </button>
      {#if exporting}
        <p class="export-progress">{exportProgress} / {exportTotal}</p>
      {/if}
    </div>
  {/if}

  {#if showPostExport}
    <div class="modal" role="alertdialog">
      <div class="modal-card">
        <p class="modal-text">Сохранено. Удалить сессию?</p>
        <p class="modal-hint">Сессии — рабочее пространство; можно очистить.</p>
        <div class="modal-actions">
          <button type="button" class="ghost" onclick={() => (showPostExport = false)}>оставить</button>
          <button type="button" class="primary" onclick={() => { showPostExport = false; deleteThisSession(); }}>удалить</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showDeleteConfirm}
    <div class="modal" role="alertdialog">
      <div class="modal-card">
        <p class="modal-text">Удалить «{session.name}»?</p>
        <p class="modal-hint">Все {outfits.length} {plural(outfits.length, OUTFITS)} в этой сессии тоже удалятся.</p>
        <div class="modal-actions">
          <button type="button" class="ghost" onclick={() => (showDeleteConfirm = false)}>отмена</button>
          <button type="button" class="primary" onclick={() => { showDeleteConfirm = false; deleteThisSession(); }}>удалить</button>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .detail {
    padding: var(--space-md);
    padding-bottom: var(--space-3xl);
    max-width: var(--content-max);
    margin: 0 auto;
  }

  .head {
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }
  .head-title {
    text-align: center;
  }
  .head-eyebrow {
    display: block;
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .head-name {
    display: block;
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    color: var(--text);
    line-height: 1.1;
    border-bottom: 1px dashed transparent;
    transition: border-color var(--dur-quick) var(--ease-out);
    margin: 0 auto;
    padding: 2px 0;
  }
  .head-name:hover {
    border-bottom-color: var(--border);
  }
  .head-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--accent);
    color: var(--text);
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    text-align: center;
    padding: 2px 0;
    outline: none;
    width: 100%;
  }
  .head-count {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
    margin-top: 2px;
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
  .icon-btn.destructive:hover {
    color: var(--accent);
  }

  .outfit-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .outfit {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-sm);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--border-soft);
  }
  @media (min-width: 600px) {
    .outfit {
      grid-template-columns: 280px 1fr;
      gap: var(--space-md);
    }
  }
  .outfit-preview {
    max-width: 320px;
  }
  .outfit-meta {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .outfit-caption {
    color: var(--text-soft);
    font-size: var(--text-md);
    line-height: var(--lh-snug);
  }
  .outfit-actions {
    display: flex;
    gap: var(--space-sm);
  }
  .outfit-action {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    font-size: var(--text-sm);
    color: var(--text-muted);
    padding: var(--space-3xs) 0;
    transition: color var(--dur-quick) var(--ease-out);
  }
  .outfit-action:hover {
    color: var(--text);
  }
  .outfit-action.destructive:hover {
    color: var(--accent);
  }

  .export-bar {
    margin-top: var(--space-lg);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-xs) var(--space-md);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .export-btn:hover {
    background: var(--accent-hover);
  }
  .export-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .export-label {
    font-size: var(--text-xl);
    line-height: 1;
  }
  .export-progress {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .empty {
    padding: var(--space-2xl) 0;
    max-width: 480px;
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
  }
  .empty-accent {
    color: var(--accent);
  }

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
  .modal-text {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    color: var(--text);
    line-height: 1.1;
    margin-bottom: var(--space-2xs);
  }
  .modal-hint {
    color: var(--text-muted);
    font-size: var(--text-sm);
    margin-bottom: var(--space-md);
  }
  .modal-actions {
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
  .primary {
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-2xs) var(--space-sm);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .primary:hover {
    background: var(--accent-hover);
  }
</style>
