<script lang="ts">
  import { Sparkles, Pin, PlusCircle, X, RefreshCw } from 'lucide-svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Item, Session } from '../shared/types';
  import { SLOT_LABEL_RU, type SlotKey, type SlotRange } from '../shared/slots';
  import { appState, setActiveSession } from '../app/routes.svelte';
  import { composeState, startGeneration, pullBatch } from './compose-state.svelte';
  import { createSession, getSession, renameSession, updateSessionRanges } from '../db/sessions';
  import Preview from './preview.svelte';
  import Thumb from '../library/thumb.svelte';
  import SlotRanges from './slot-ranges.svelte';
  import LockPicker from './lock-picker.svelte';
  import Tinder from './tinder.svelte';

  let showLockPicker = $state(false);
  let editingName = $state(false);
  let nameDraft = $state('');

  // Library: live-subscribe so the generator always has fresh data.
  $effect(() => {
    const obs = liveQuery(() => db.items.orderBy('createdAt').reverse().toArray());
    const sub = obs.subscribe({
      next: (v) => {
        composeState.library = v;
      },
    });
    return () => sub.unsubscribe();
  });

  // Ensure there's an active session. Auto-create on first compose-tab visit.
  $effect(() => {
    (async () => {
      if (composeState.session && composeState.session.id === appState.activeSessionId) return;
      let session: Session | undefined;
      if (appState.activeSessionId) {
        session = await getSession(appState.activeSessionId);
      }
      if (!session) {
        const name = defaultSessionName();
        session = await createSession(name);
        setActiveSession(session.id);
      }
      composeState.session = session;
    })();
  });

  function defaultSessionName(): string {
    const d = new Date();
    return `Образ ${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`;
  }

  async function newSession() {
    const s = await createSession(defaultSessionName());
    setActiveSession(s.id);
    composeState.session = s;
    composeState.lockedItems = [];
    composeState.results = [];
    composeState.seenKeys = new Set();
    composeState.tinderIndex = 0;
  }

  function startEditName() {
    if (!composeState.session) return;
    nameDraft = composeState.session.name;
    editingName = true;
  }

  async function commitName() {
    if (!composeState.session) return;
    editingName = false;
    const next = nameDraft.trim() || composeState.session.name;
    if (next !== composeState.session.name) {
      await renameSession(composeState.session.id, next);
      composeState.session = { ...composeState.session, name: next };
    }
  }

  async function onRangesChanged(next: Record<SlotKey, SlotRange>) {
    if (!composeState.session) return;
    composeState.session = { ...composeState.session, slotRanges: next };
    await updateSessionRanges(composeState.session.id, next);
  }

  function setLocked(items: Item[]) {
    composeState.lockedItems = items;
    showLockPicker = false;
  }

  function generate() {
    startGeneration(30);
    composeState.tinderIndex = 0;
  }

  function more() {
    pullBatch(30);
  }

  function openTinderAt(index: number) {
    composeState.tinderIndex = index;
    composeState.tinderOpen = true;
  }

  function clearLocked(itemId: string) {
    composeState.lockedItems = composeState.lockedItems.filter((i) => i.id !== itemId);
  }
</script>

<section class="page">
  <header class="hero">
    <div class="session-bar">
      <span class="session-eyebrow">сессия</span>
      {#if editingName}
        <input
          class="session-input"
          autofocus
          bind:value={nameDraft}
          onblur={commitName}
          onkeydown={(e) => { if (e.key === 'Enter') commitName(); }}
        />
      {:else}
        <button class="session-name" type="button" onclick={startEditName} title="Переименовать">
          {composeState.session?.name ?? '…'}
        </button>
      {/if}
      <button class="session-new" type="button" onclick={newSession} title="Новая сессия">
        <PlusCircle size={16} strokeWidth={1.6} aria-hidden="true" />
        <span>новая</span>
      </button>
    </div>

    <h1 class="title">
      <span class="display">Собрать образ</span>
    </h1>
    <p class="hint">
      Закрепи что-то, что точно должно быть, выставь диапазоны — остальное подберу.
    </p>
  </header>

  <div class="controls">
    <div class="constraints">
      <div class="constraints-head">
        <span class="constraints-label">
          <Pin size={14} strokeWidth={1.6} aria-hidden="true" />
          закреплено
        </span>
        <button class="link" type="button" onclick={() => (showLockPicker = true)}>
          {composeState.lockedItems.length === 0 ? 'добавить' : 'изменить'}
        </button>
      </div>
      {#if composeState.lockedItems.length === 0}
        <p class="constraints-empty">Ничего не закреплено — сгенерится случайный образ.</p>
      {:else}
        <ul class="lock-strip">
          {#each composeState.lockedItems as item (item.id)}
            <li>
              <div class="lock-tile">
                <div class="lock-photo">
                  <Thumb blob={item.thumbnail ?? item.blob} alt={item.name} />
                </div>
                <button class="lock-remove" type="button" aria-label="Убрать" onclick={() => clearLocked(item.id)}>
                  <X size={12} strokeWidth={2} aria-hidden="true" />
                </button>
                <p class="lock-name">{item.name}</p>
                <p class="lock-slot">{item.slot ? SLOT_LABEL_RU[item.slot] : '—'}</p>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if composeState.session}
      <SlotRanges ranges={composeState.session.slotRanges} onChange={onRangesChanged} />
    {/if}

    <button class="cta" type="button" onclick={generate} disabled={composeState.library.length === 0}>
      <Sparkles size={22} strokeWidth={1.6} aria-hidden="true" />
      <span class="cta-label display">Сгенерировать</span>
    </button>
  </div>

  {#if composeState.library.length === 0}
    <div class="empty">
      <p class="empty-eyebrow">пусто в гардеробе</p>
      <p class="empty-title">
        <span class="display">Сначала добавь</span>
        <br />
        <span class="display empty-accent">вещи в гардероб.</span>
      </p>
    </div>
  {:else if composeState.results.length > 0}
    <div class="results-head">
      <span class="results-count">{composeState.results.length} {composeState.exhausted ? 'итого' : 'пока'}</span>
      <button class="link" type="button" onclick={() => openTinderAt(0)}>смотреть по одному →</button>
    </div>

    <ul class="results">
      {#each composeState.results as combo, idx (combo.key)}
        <li>
          <button class="result" type="button" onclick={() => openTinderAt(idx)}>
            <Preview {combo} />
          </button>
        </li>
      {/each}
    </ul>

    {#if !composeState.exhausted}
      <div class="more">
        <button class="more-btn" type="button" onclick={more}>
          <RefreshCw size={16} strokeWidth={1.6} aria-hidden="true" />
          <span>ещё 30</span>
        </button>
      </div>
    {:else}
      <p class="exhausted">варианты кончились — попробуй другие закреплённые вещи или диапазоны</p>
    {/if}
  {/if}

  {#if showLockPicker}
    <LockPicker
      initial={composeState.lockedItems}
      onConfirm={setLocked}
      onClose={() => (showLockPicker = false)}
    />
  {/if}

  {#if composeState.tinderOpen}
    <Tinder onClose={() => (composeState.tinderOpen = false)} />
  {/if}
</section>

<style>
  .page {
    padding: var(--space-md);
    padding-bottom: var(--space-3xl);
    max-width: var(--content-max);
    margin: 0 auto;
  }

  .hero {
    margin-bottom: var(--space-md);
  }

  .session-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
  }
  .session-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .session-name {
    color: var(--text);
    font-family: var(--font-display);
    font-size: var(--text-xl);
    line-height: 1;
    padding: var(--space-3xs) 0;
    border-bottom: 1px dashed var(--border);
    transition: border-color var(--dur-quick) var(--ease-out);
  }
  .session-name:hover {
    border-bottom-color: var(--text);
  }
  .session-input {
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--accent);
    color: var(--text);
    font-family: var(--font-display);
    font-size: var(--text-xl);
    padding: var(--space-3xs) 0;
    outline: none;
  }
  .session-new {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    margin-left: auto;
    color: var(--text-muted);
    font-size: var(--text-sm);
    padding: var(--space-3xs) var(--space-2xs);
    border-radius: var(--radius-2);
    transition: color var(--dur-quick) var(--ease-out), background var(--dur-quick) var(--ease-out);
  }
  .session-new:hover {
    color: var(--text);
    background: var(--surface);
  }

  .title {
    margin-bottom: var(--space-2xs);
  }
  .title .display {
    font-size: var(--text-3xl);
    color: var(--text);
    line-height: 1;
    letter-spacing: var(--track-tight);
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--text-md);
    max-width: 56ch;
    line-height: var(--lh-snug);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-md);
  }

  .constraints {
    background: var(--surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-2);
    padding: var(--space-sm);
  }
  .constraints-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2xs);
  }
  .constraints-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .link {
    color: var(--accent);
    font-size: var(--text-sm);
    padding: var(--space-3xs);
    margin: calc(-1 * var(--space-3xs));
    border-radius: var(--radius-2);
    transition: opacity var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .link:hover { opacity: 0.8; }
  }
  .link:active {
    opacity: 0.7;
    transform: scale(0.96);
    transition-duration: 60ms;
  }
  .constraints-empty {
    color: var(--text-faint);
    font-size: var(--text-sm);
    margin-top: var(--space-2xs);
    line-height: var(--lh-snug);
  }
  .lock-strip {
    display: flex;
    gap: var(--space-2xs);
    overflow-x: auto;
    overflow-y: hidden;
    padding: var(--space-3xs);
    margin: 0 calc(-1 * var(--space-3xs));
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .lock-strip::-webkit-scrollbar {
    display: none;
  }
  .lock-tile {
    width: 84px;
    position: relative;
  }
  .lock-photo {
    width: 84px;
    height: 84px;
    background: var(--tile);
    padding: 6%;
    margin-bottom: var(--space-3xs);
    border-radius: var(--radius-2);
  }
  .lock-remove {
    position: absolute;
    top: 2px;
    right: 2px;
    background: var(--scrim);
    color: var(--text);
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    border-radius: 50%;
  }
  .lock-name {
    font-size: var(--text-xs);
    color: var(--text);
    line-height: var(--lh-snug);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-clamp: 1;
  }
  .lock-slot {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: var(--track-caps);
    margin-top: 1px;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2xs);
    background: var(--accent);
    color: var(--accent-on);
    padding: var(--space-md) var(--space-md);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .cta:hover {
      background: var(--accent-hover);
    }
  }
  .cta:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 60ms;
  }
  .cta:disabled {
    background: var(--surface-2);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  .cta-label {
    font-size: var(--text-2xl);
    line-height: 1;
    letter-spacing: var(--track-tight);
  }

  .results-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: var(--space-2xs);
  }
  .results-count {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .results {
    display: grid;
    gap: var(--space-2xs);
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: 600px) {
    .results { grid-template-columns: repeat(3, 1fr); gap: var(--space-sm); }
  }
  @media (min-width: 900px) {
    .results { grid-template-columns: repeat(4, 1fr); }
  }
  @media (min-width: 1200px) {
    .results { grid-template-columns: repeat(5, 1fr); }
  }
  .result {
    width: 100%;
    border-radius: var(--radius-2);
    overflow: hidden;
    transition: transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .result:hover {
      transform: translateY(-2px);
    }
  }
  .result:active {
    transform: scale(0.97);
    transition-duration: 60ms;
  }

  .more {
    display: flex;
    justify-content: center;
    margin-top: var(--space-md);
  }
  .more-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-2xs) var(--space-md);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out), transform var(--dur-quick) var(--ease-out);
  }
  @media (hover: hover) {
    .more-btn:hover { background: var(--surface); }
  }
  .more-btn:active {
    background: var(--surface-2);
    transform: scale(0.97);
    transition-duration: 60ms;
  }
  .exhausted {
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-sm);
    margin-top: var(--space-md);
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
</style>
