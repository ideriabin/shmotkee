/*
 * Outfit combination generator — pure, no DOM, no I/O.
 *
 * Yields unique combinations lazily until the seen-set covers all
 * reachable combinations under current constraints. Both the grid
 * (pulls 30 per page) and the Tinder view (pulls 1 at a time) consume
 * from the same generator instance.
 */

import {
  SLOT_KEYS,
  SLOT_RENDER_ORDER,
  type SlotKey,
  type SlotRange,
} from '../shared/slots';
import type { Item, Combination } from '../shared/types';

const MAX_DEDUPE_RETRIES = 20;

export type GenerateOpts = {
  library: Item[];
  locked: Item[];
  slotRanges: Record<SlotKey, SlotRange>;
  seenKeys: Set<string>;
};

export function* generate(opts: GenerateOpts): Generator<Combination> {
  const { library, locked, slotRanges, seenKeys } = opts;

  // Group library by slot.
  const bySlot: Record<SlotKey, Item[]> = emptyBySlot();
  for (const item of library) bySlot[item.slot].push(item);

  // Locked items by slot.
  const lockedBySlot: Record<SlotKey, Item[]> = emptyBySlot();
  for (const item of locked) lockedBySlot[item.slot].push(item);

  // Pool of unlocked items per slot.
  const lockedIds = new Set(locked.map((i) => i.id));
  const unlocked: Record<SlotKey, Item[]> = emptyBySlot();
  for (const slot of SLOT_KEYS) {
    unlocked[slot] = bySlot[slot].filter((i) => !lockedIds.has(i.id));
  }

  while (true) {
    let combo: Combination | null = null;
    for (let attempt = 0; attempt < MAX_DEDUPE_RETRIES; attempt++) {
      combo = sampleOne(unlocked, lockedBySlot, slotRanges);
      if (combo && !seenKeys.has(combo.key)) break;
      combo = null;
    }
    if (!combo) return; // exhausted under current constraints
    seenKeys.add(combo.key);
    yield combo;
  }
}

function sampleOne(
  unlocked: Record<SlotKey, Item[]>,
  lockedBySlot: Record<SlotKey, Item[]>,
  ranges: Record<SlotKey, SlotRange>,
): Combination | null {
  const result: Record<SlotKey, Item[]> = emptyBySlot();
  let totalCount = 0;

  for (const slot of SLOT_KEYS) {
    const range = ranges[slot];
    const lockedHere = lockedBySlot[slot];
    const pool = unlocked[slot];
    const lockedCount = lockedHere.length;

    if (lockedCount >= range.max) {
      // Already at or above max from locks alone — use locks only,
      // clipped to max so we don't violate the user's range.
      const sliced = lockedHere.slice(0, range.max);
      result[slot] = sortByZ(sliced);
      totalCount += sliced.length;
      continue;
    }

    const effectiveMin = Math.max(0, range.min - lockedCount);
    const effectiveMax = Math.min(range.max - lockedCount, pool.length);

    if (effectiveMax < effectiveMin) {
      // Not enough items in pool to satisfy min — fall back to locks only.
      result[slot] = sortByZ(lockedHere);
      totalCount += lockedHere.length;
      continue;
    }

    const n = randInt(effectiveMin, effectiveMax);
    const sampled = sample(pool, n);
    const combined = sortByZ([...lockedHere, ...sampled]);
    result[slot] = combined;
    totalCount += combined.length;
  }

  // An empty outfit isn't a valid one.
  if (totalCount === 0) return null;

  return { bySlot: result, key: makeKey(result) };
}

function emptyBySlot(): Record<SlotKey, Item[]> {
  return {
    bottom: [],
    full_body: [],
    top: [],
    outerwear: [],
    shoes: [],
    accessories: [],
    other: [],
  };
}

function sortByZ(items: Item[]): Item[] {
  return [...items].sort((a, b) => a.zPriority - b.zPriority || a.id.localeCompare(b.id));
}

function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sample<T>(pool: T[], n: number): T[] {
  if (n <= 0) return [];
  if (n >= pool.length) return [...pool];
  // Fisher-Yates partial shuffle.
  const arr = [...pool];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, n);
}

/**
 * Canonical hash for combination dedupe.
 * Slot render order + sorted item ids → stable identity.
 */
function makeKey(bySlot: Record<SlotKey, Item[]>): string {
  const parts: string[] = [];
  for (const slot of SLOT_RENDER_ORDER) {
    const items = bySlot[slot];
    if (items.length === 0) continue;
    const ids = items.map((i) => i.id).sort();
    parts.push(`${slot}:${ids.join(',')}`);
  }
  return parts.join('|');
}
