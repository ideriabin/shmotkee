<script lang="ts">
  import { SLOT_KEYS, SLOT_LABEL_RU, type SlotKey, type SlotRange } from '../shared/slots';

  let {
    ranges,
    onChange,
  }: {
    ranges: Record<SlotKey, SlotRange>;
    onChange: (next: Record<SlotKey, SlotRange>) => void;
  } = $props();

  function nudge(slot: SlotKey, bound: 'min' | 'max', delta: number) {
    const cur = ranges[slot];
    let next: SlotRange = { ...cur };
    if (bound === 'min') {
      next.min = Math.max(0, Math.min(cur.max, cur.min + delta));
    } else {
      next.max = Math.max(cur.min, Math.min(9, cur.max + delta));
    }
    onChange({ ...ranges, [slot]: next });
  }
</script>

<details class="ranges">
  <summary class="ranges-head">
    <span class="ranges-title">Сколько вещей в слотах</span>
    <span class="ranges-hint">мин — макс</span>
  </summary>
  <ul class="rows">
    {#each SLOT_KEYS as slot (slot)}
      <li class="row">
        <span class="row-name">{SLOT_LABEL_RU[slot]}</span>
        <div class="bound">
          <button type="button" aria-label="мин -1" onclick={() => nudge(slot, 'min', -1)}>−</button>
          <span class="bound-value">{ranges[slot].min}</span>
          <button type="button" aria-label="мин +1" onclick={() => nudge(slot, 'min', 1)}>+</button>
        </div>
        <span class="dash">—</span>
        <div class="bound">
          <button type="button" aria-label="макс -1" onclick={() => nudge(slot, 'max', -1)}>−</button>
          <span class="bound-value">{ranges[slot].max}</span>
          <button type="button" aria-label="макс +1" onclick={() => nudge(slot, 'max', 1)}>+</button>
        </div>
      </li>
    {/each}
  </ul>
</details>

<style>
  .ranges {
    background: var(--surface);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-2);
  }

  .ranges-head {
    list-style: none;
    cursor: pointer;
    padding: var(--space-xs) var(--space-sm);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
    color: var(--text);
    font-size: var(--text-md);
    user-select: none;
  }
  .ranges-head::-webkit-details-marker {
    display: none;
  }
  .ranges-head::after {
    content: '+';
    font-family: var(--font-display);
    font-size: var(--text-xl);
    color: var(--text-muted);
    line-height: 1;
    transition: transform var(--dur-quick) var(--ease-out);
  }
  .ranges[open] .ranges-head::after {
    content: '−';
  }

  .ranges-title {
    font-weight: var(--w-medium);
  }
  .ranges-hint {
    font-size: var(--text-xs);
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .rows {
    padding: 0 var(--space-sm) var(--space-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-3xs);
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-2xs) 0;
    border-top: 1px solid var(--border-soft);
  }
  .row:first-child {
    border-top: none;
  }
  .row-name {
    color: var(--text-soft);
    font-size: var(--text-md);
  }
  .dash {
    color: var(--text-faint);
  }
  .bound {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3xs);
  }
  .bound button {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text);
    border-radius: var(--radius-2);
    transition: background var(--dur-quick) var(--ease-out);
    font-size: var(--text-md);
  }
  .bound button:hover {
    background: var(--surface-3);
  }
  .bound-value {
    font-variant-numeric: tabular-nums;
    color: var(--text);
    min-width: 1.5ch;
    text-align: center;
  }
</style>
