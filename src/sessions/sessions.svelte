<script lang="ts">
  import { liveQuery } from 'dexie';
  import { db } from '../db/schema';
  import type { Session } from '../shared/types';
  import { plural, OUTFITS, MINUTES_AGO, HOURS_AGO, DAYS_AGO } from '../shared/ru-plural';
  import SessionDetail from './session-detail.svelte';

  let sessions = $state<Session[]>([]);
  let outfitCounts = $state<Record<string, number>>({});
  let openSession = $state<Session | null>(null);

  $effect(() => {
    const sessionsObs = liveQuery(() => db.sessions.orderBy('updatedAt').reverse().toArray());
    const sub1 = sessionsObs.subscribe({ next: (v) => (sessions = v) });

    const outfitsObs = liveQuery(async () => {
      const all = await db.savedOutfits.toArray();
      const counts: Record<string, number> = {};
      for (const o of all) {
        counts[o.sessionId] = (counts[o.sessionId] ?? 0) + 1;
      }
      return counts;
    });
    const sub2 = outfitsObs.subscribe({ next: (v) => (outfitCounts = v) });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  });

  function relativeTime(ts: number): string {
    const diffMs = Date.now() - ts;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} ${plural(min, MINUTES_AGO)}`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ${plural(hr, HOURS_AGO)}`;
    const day = Math.floor(hr / 24);
    if (day === 1) return 'вчера';
    if (day < 7) return `${day} ${plural(day, DAYS_AGO)}`;
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }
</script>

{#if openSession}
  <SessionDetail
    session={openSession}
    onBack={() => (openSession = null)}
    onDeleted={() => (openSession = null)}
  />
{:else}
  <section class="page">
    <header class="hero">
      <h1 class="title">
        <span class="display">Образы</span>
        <span class="title-count">{sessions.length}</span>
      </h1>
      <p class="hint">Сохранённые образы по сессиям. Открой, чтобы посмотреть и выгрузить.</p>
    </header>

    {#if sessions.length === 0}
      <div class="empty">
        <p class="empty-eyebrow">пока ничего</p>
        <p class="empty-title">
          <span class="display">Сохраняй образы</span>
          <br />
          <span class="display empty-accent">в режиме «Собрать».</span>
        </p>
        <p class="empty-hint">
          На вкладке «Собрать» нажми <strong>заебись</strong> — образ упадёт сюда.
        </p>
      </div>
    {:else}
      <ul class="sessions">
        {#each sessions as s (s.id)}
          <li>
            <button class="session-row" type="button" onclick={() => (openSession = s)}>
              <span class="session-name display">{s.name}</span>
              <div class="session-meta">
                <span class="session-count">
                  {outfitCounts[s.id] ?? 0}
                  <span class="session-count-label">{plural(outfitCounts[s.id] ?? 0, OUTFITS)}</span>
                </span>
                <span class="session-time">{relativeTime(s.updatedAt)}</span>
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

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

  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2xs);
    margin-bottom: var(--space-2xs);
  }
  .title .display {
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
  .hint {
    color: var(--text-muted);
    font-size: var(--text-md);
    line-height: var(--lh-snug);
    max-width: 56ch;
  }

  .sessions {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--border-soft);
  }
  .session-row {
    width: 100%;
    text-align: left;
    padding: var(--space-md) 0;
    border-bottom: 1px solid var(--border-soft);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-md);
    transition: background var(--dur-quick) var(--ease-out);
  }
  .session-row:hover {
    background: var(--surface);
  }
  .session-name {
    font-size: var(--text-2xl);
    color: var(--text);
    line-height: 1.1;
  }
  .session-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }
  .session-count {
    font-variant-numeric: tabular-nums;
    color: var(--text);
    font-size: var(--text-md);
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-3xs);
  }
  .session-count-label {
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  .session-time {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-faint);
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
    margin-bottom: var(--space-md);
  }
  .empty-accent {
    color: var(--accent);
  }
  .empty-hint {
    color: var(--text-muted);
    font-size: var(--text-md);
    line-height: var(--lh-snug);
  }
  .empty-hint strong {
    color: var(--text);
    font-weight: var(--w-medium);
  }
</style>
