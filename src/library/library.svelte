<script lang="ts">
  import { Plus } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item } from '../shared/types';
  import { SLOT_KEYS, SLOT_LABEL_RU, type SlotKey } from '../shared/slots';
  import Thumb from './thumb.svelte';
  import UploadSheet from './upload-sheet.svelte';
  import ItemDetail from './item-detail.svelte';

  type Filter = 'all' | SlotKey;

  let filter = $state<Filter>('all');
  let items = $state<Item[]>([]);
  let showUpload = $state(false);
  let detailItem = $state<Item | null>(null);

  $effect(() => {
    const obs = liveQuery(() => db.items.orderBy('createdAt').reverse().toArray());
    const sub = obs.subscribe({
      next: (v) => {
        items = v;
      },
    });
    return () => sub.unsubscribe();
  });

  const filtered = $derived(filter === 'all' ? items : items.filter((it) => it.slot === filter));

  const slotCounts = $derived.by(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const key of SLOT_KEYS) counts[key] = 0;
    for (const it of items) counts[it.slot] = (counts[it.slot] ?? 0) + 1;
    return counts;
  });
</script>

<section class="page">
  <header class="hero">
    <h1 class="title">
      <span class="display title-strong">Гардероб</span>
      <span class="title-count">{items.length}</span>
    </h1>

    <div class="filters" role="tablist" aria-label="Фильтр по слотам">
      <button
        role="tab"
        type="button"
        class="filter"
        class:active={filter === 'all'}
        aria-selected={filter === 'all'}
        onclick={() => (filter = 'all')}
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
          onclick={() => (filter = slot)}
        >
          {SLOT_LABEL_RU[slot]}
          <span class="filter-count">{slotCounts[slot] ?? 0}</span>
        </button>
      {/each}
    </div>
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
      <p class="empty-hint">Загрузи что-нибудь в «{SLOT_LABEL_RU[filter as SlotKey]}».</p>
    </div>
  {:else}
    <ul class="grid">
      {#each filtered as item (item.id)}
        <li>
          <button class="tile" type="button" onclick={() => (detailItem = item)}>
            <div class="tile-photo">
              <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} />
            </div>
            <p class="tile-name" title={item.name}>{item.name}</p>
            <p class="tile-meta">{SLOT_LABEL_RU[item.slot]}</p>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <button class="fab" type="button" aria-label="Добавить" onclick={() => (showUpload = true)}>
    <Plus size={26} strokeWidth={1.6} aria-hidden="true" />
  </button>

  {#if showUpload}
    <UploadSheet onClose={() => (showUpload = false)} />
  {/if}

  {#if detailItem}
    <ItemDetail item={detailItem} onClose={() => (detailItem = null)} />
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
  .filter-count {
    font-size: var(--text-xs);
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

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
  }
  .tile:hover {
    transform: translateY(-2px);
  }
  .tile-photo {
    background: var(--surface);
    aspect-ratio: 1;
    padding: 8%;
    margin-bottom: var(--space-2xs);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .tile:hover .tile-photo {
    background: var(--surface-2);
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

  /* Empty state — feels intentional, not "nothing here" */
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

  /* Floating Action Button — bottom right above nav */
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
  .fab:active {
    background: var(--accent-press);
    transform: translateY(0);
  }
  @media (min-width: 900px) {
    .fab {
      bottom: var(--space-lg);
      right: var(--space-lg);
    }
  }
</style>
