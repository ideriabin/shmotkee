<script lang="ts">
  import { X, FolderOpen, FileImage } from 'lucide-svelte';
  import { createItem } from '../db/items';
  import { SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
  import { generateThumbnail, filenameStem } from './thumbnail';

  let {
    onClose,
    defaultSlot = null,
  }: { onClose: () => void; defaultSlot?: SlotKey | null } = $props();

  type Step = 'source' | 'importing' | 'done';

  let step = $state<Step>('source');
  let totalCount = $state(0);
  let doneCount = $state(0);
  let failedCount = $state(0);
  let lastError = $state<string>('');

  // Folder picker only available on desktop browsers that support webkitdirectory.
  // iOS Safari/Chrome silently ignore the attribute; we hide the option there.
  const folderSupport = (() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return false;
    // Hint: webkitdirectory presence on HTMLInputElement
    const test = document.createElement('input');
    return 'webkitdirectory' in test || 'directory' in test;
  })();

  let fileInput: HTMLInputElement | undefined = $state();
  let folderInput: HTMLInputElement | undefined = $state();

  function asFolderInput(node: HTMLInputElement) {
    node.setAttribute('webkitdirectory', '');
    node.setAttribute('directory', '');
  }

  function pickFiles() {
    fileInput?.click();
  }

  function pickFolder() {
    folderInput?.click();
  }

  async function onFilesChosen(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const list = input.files;
    if (!list || list.length === 0) return;
    const images: File[] = [];
    for (const f of list) {
      if (f.type.startsWith('image/')) images.push(f);
    }
    if (images.length === 0) {
      lastError = 'Среди выбранных файлов нет картинок.';
      return;
    }
    await importAll(images);
  }

  async function importAll(files: File[]) {
    step = 'importing';
    totalCount = files.length;
    doneCount = 0;
    failedCount = 0;

    const tasks = files.map(async (file) => {
      try {
        const thumb = await generateThumbnail(file);
        await createItem({
          name: filenameStem(file.name),
          slot: defaultSlot,
          blob: file,
          thumbnail: thumb,
        });
      } catch (err) {
        failedCount++;
        console.error('Failed to import', file.name, err);
      } finally {
        doneCount++;
      }
    });

    await Promise.all(tasks);
    step = 'done';
  }

  let closing = $state(false);
  function close() {
    if (closing) return;
    closing = true;
    setTimeout(onClose, 220);
  }
</script>

<div
  class="overlay"
  class:closing
  role="dialog"
  aria-modal="true"
  aria-labelledby="upload-title"
  onclick={(e) => {
    if (e.target === e.currentTarget) close();
  }}
>
  <div class="sheet" class:closing role="document">
    <span class="grabber" aria-hidden="true"></span>
    <header class="sheet-head">
      <h2 id="upload-title" class="sheet-title">
        {#if step === 'source'}
          Добавить{#if defaultSlot}<span class="sheet-title-suffix"> в {SLOT_LABEL_RU[defaultSlot]}</span>{/if}
        {:else if step === 'importing'}
          Загружаю
        {:else}
          Готово
        {/if}
      </h2>
      <button class="icon-btn" type="button" aria-label="Закрыть" onclick={close}>
        <X size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </header>

    <div class="sheet-body">
      {#if step === 'source'}
        <p class="hint">Загрузи фотки вещей. Они останутся локально — никуда не отправляются.</p>

        <div class="source-grid">
          <button class="source" type="button" onclick={pickFiles}>
            <FileImage size={28} strokeWidth={1.5} aria-hidden="true" />
            <span class="source-label">Файлы</span>
            <span class="source-hint">Выбрать одну или несколько картинок</span>
          </button>

          {#if folderSupport}
            <button class="source" type="button" onclick={pickFolder}>
              <FolderOpen size={28} strokeWidth={1.5} aria-hidden="true" />
              <span class="source-label">Папка</span>
              <span class="source-hint">Загрузить всю папку целиком</span>
            </button>
          {/if}
        </div>

        {#if lastError}
          <p class="error">{lastError}</p>
        {/if}

        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          multiple
          onchange={onFilesChosen}
          style="display:none"
        />
        <input
          bind:this={folderInput}
          type="file"
          use:asFolderInput
          multiple
          onchange={onFilesChosen}
          style="display:none"
        />
      {:else if step === 'importing'}
        <div class="progress">
          <p class="progress-count">{doneCount} / {totalCount}</p>
          <div class="bar">
            <div class="bar-fill" style:width="{(doneCount / Math.max(totalCount, 1)) * 100}%"></div>
          </div>
        </div>
      {:else}
        <div class="done">
          <p class="done-stat">
            Загружено: <strong>{doneCount - failedCount}</strong>
            {#if failedCount > 0}
              <br />Не получилось: <strong>{failedCount}</strong>
            {/if}
          </p>
          {#if defaultSlot}
            <p class="done-hint">
              Вещи добавлены в «{SLOT_LABEL_RU[defaultSlot]}».
            </p>
          {:else}
            <p class="done-hint">
              Все вещи помечены «Без слота». В гардеробе можно выделить нужные и разложить по категориям.
            </p>
          {/if}
          <button class="primary" type="button" onclick={close}>Хорошо</button>
        </div>
      {/if}
    </div>
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
    position: relative;
    background: var(--surface);
    width: 100%;
    max-width: 560px;
    border-top: 1px solid var(--border);
    border-radius: var(--radius-2) var(--radius-2) 0 0;
    padding: var(--space-md);
    padding-top: calc(var(--space-md) + 18px); /* room for grabber */
    padding-bottom: calc(var(--space-md) + var(--safe-bottom));
    animation: slide-up var(--dur-medium) var(--ease-out-expo);
    max-height: 85dvh;
    overflow-y: auto;
  }

  /* iOS-style drag indicator at the top of the sheet — pure visual
     affordance, not actually draggable (yet). */
  .grabber {
    position: absolute;
    top: var(--space-2xs);
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--border);
    pointer-events: none;
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
  .sheet-title-suffix {
    color: var(--text-muted);
    font-size: var(--text-xl);
  }

  .icon-btn {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .icon-btn:hover { color: var(--text); }
  }
  .icon-btn:active {
    color: var(--text);
    background: var(--surface-2);
    transform: scale(0.9);
    transition-duration: 60ms;
  }

  .hint {
    color: var(--text-muted);
    font-size: var(--text-md);
    margin-bottom: var(--space-md);
  }

  .error {
    color: var(--accent);
    font-size: var(--text-md);
    margin-top: var(--space-sm);
  }

  .source-grid {
    display: grid;
    gap: var(--space-2xs);
    grid-template-columns: 1fr;
  }
  @media (min-width: 480px) {
    .source-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .source {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2xs);
    padding: var(--space-md);
    background: var(--surface-2);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-2);
    color: var(--text);
    transition: background var(--dur-quick) var(--ease-out), border-color var(--dur-quick) var(--ease-out);
    min-height: 132px;
  }
  .source:hover {
    background: var(--surface-3);
    border-color: var(--border);
  }
  .source-label {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    line-height: 1;
  }
  .source-hint {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }

  .slot-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border-soft);
    border-radius: var(--radius-2);
    overflow: hidden;
  }
  .slot-row {
    width: 100%;
    background: var(--surface-2);
    padding: var(--space-sm) var(--space-md);
    text-align: left;
    transition: background var(--dur-quick) var(--ease-out);
  }
  .slot-row:hover {
    background: var(--surface-3);
  }
  .slot-name {
    font-size: var(--text-lg);
    color: var(--text);
  }

  .progress {
    text-align: center;
    padding: var(--space-md) 0;
  }
  .progress-count {
    font-family: var(--font-display);
    font-size: var(--text-3xl);
    color: var(--text);
    margin-bottom: var(--space-md);
  }
  .bar {
    height: 4px;
    background: var(--surface-2);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--accent);
    transition: width var(--dur-quick) linear;
  }

  .done {
    text-align: center;
    padding: var(--space-md) 0;
  }
  .done-stat {
    font-size: var(--text-lg);
    color: var(--text);
    margin-bottom: var(--space-2xs);
  }
  .done-hint {
    font-size: var(--text-sm);
    color: var(--text-muted);
    margin-bottom: var(--space-md);
    line-height: var(--lh-snug);
    max-width: 36ch;
    margin-left: auto;
    margin-right: auto;
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

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  @keyframes slide-down {
    from { transform: translateY(0); }
    to { transform: translateY(100%); }
  }
  .overlay.closing {
    animation: fade-out var(--dur-base) var(--ease-out) forwards;
  }
  .sheet.closing {
    animation: slide-down var(--dur-base) var(--ease-out) forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .overlay, .sheet {
      animation: none;
    }
  }
</style>
