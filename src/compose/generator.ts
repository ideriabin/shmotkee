/*
 * Outfit combination generator — pure, no DOM, no I/O.
 *
 * Yields unique combinations lazily until the seen-set covers all
 * reachable combinations under current constraints. Both the grid
 * (pulls 30 per page) and the Tinder view (pulls 1 at a time) consume
 * from the same generator instance.
 *
 * Each slot samples independently within its [min, max] range. Subset
 * narrowing happens *outside* the generator (compose-state.applySubset
 * filters `library` before passing it in).
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
  slotRanges: Record<SlotKey, SlotRange>;
  seenKeys: Set<string>;
};

export function* generate(opts: GenerateOpts): Generator<Combination> {
  const { library, slotRanges, seenKeys } = opts;

  // Group library by slot. Unclassified items (slot === null) are silently
  // excluded from generation.
  const bySlot: Record<SlotKey, Item[]> = emptyBySlot();
  for (const item of library) {
    if (item.slot !== null) bySlot[item.slot].push(item);
  }

  while (true) {
    let combo: Combination | null = null;
    for (let attempt = 0; attempt < MAX_DEDUPE_RETRIES; attempt++) {
      combo = sampleOne(bySlot, slotRanges);
      if (combo && !seenKeys.has(combo.key)) break;
      combo = null;
    }
    if (!combo) return; // exhausted under current constraints
    seenKeys.add(combo.key);
    yield combo;
  }
}

function sampleOne(
  bySlot: Record<SlotKey, Item[]>,
  ranges: Record<SlotKey, SlotRange>,
): Combination | null {
  const result: Record<SlotKey, Item[]> = emptyBySlot();
  let totalCount = 0;

  for (const slot of SLOT_KEYS) {
    const range = ranges[slot];
    const pool = bySlot[slot];
    const effectiveMax = Math.min(range.max, pool.length);
    if (effectiveMax < range.min) {
      // Not enough items in the pool to satisfy min — skip this slot.
      continue;
    }
    const n = randInt(range.min, effectiveMax);
    const sampled = sortByZ(sample(pool, n));
    result[slot] = sampled;
    totalCount += sampled.length;
  }

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
