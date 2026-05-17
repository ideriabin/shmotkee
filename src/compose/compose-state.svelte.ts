/*
 * Compose tab state — active session, locked items, current generator,
 * accumulated results, and Tinder view position. Lives at module scope
 * so it survives tab switches within the same browsing session.
 *
 * Subset (`session.subsetIds`) restricts the generator's source pool to
 * the listed items. Locked items bypass the subset — they're an output
 * requirement, not a source filter, so they're auto-included even if
 * outside the curated pool.
 */

import type { Combination, Item, Session } from '../shared/types';
import { generate } from './generator';

export const composeState = $state({
  session: null as Session | null,
  lockedItems: [] as Item[],
  library: [] as Item[],
  results: [] as Combination[],
  seenKeys: new Set<string>(),
  generatorActive: false,
  exhausted: false,

  tinderOpen: false,
  tinderIndex: 0,
});

let currentGenerator: Generator<Combination> | null = null;

export function resetGeneration() {
  composeState.results = [];
  composeState.seenKeys = new Set<string>();
  composeState.exhausted = false;
  composeState.generatorActive = false;
  currentGenerator = null;
}

export function startGeneration(batchSize: number) {
  if (!composeState.session) return;
  resetGeneration();
  const lib = applySubset(
    composeState.library,
    composeState.session.subsetIds,
    composeState.lockedItems,
  );
  currentGenerator = generate({
    library: lib,
    locked: composeState.lockedItems,
    slotRanges: composeState.session.slotRanges,
    seenKeys: composeState.seenKeys,
  });
  composeState.generatorActive = true;
  pullBatch(batchSize);
}

export function pullBatch(n: number): number {
  if (!currentGenerator) return 0;
  let pulled = 0;
  for (let i = 0; i < n; i++) {
    const next = currentGenerator.next();
    if (next.done) {
      composeState.exhausted = true;
      composeState.generatorActive = false;
      currentGenerator = null;
      break;
    }
    composeState.results.push(next.value);
    pulled++;
  }
  return pulled;
}

/**
 * Reduce the full active library to what the generator should actually see.
 * Null/empty subset → return library unchanged (full wardrobe mode).
 * Non-empty subset → only items in the subset, plus any locked items that
 * happen to live outside it (locks always bypass the source constraint).
 */
export function applySubset(
  library: Item[],
  subsetIds: string[] | null,
  locked: Item[],
): Item[] {
  if (!subsetIds || subsetIds.length === 0) return library;
  const pool = new Set(subsetIds);
  const lockedIds = new Set(locked.map((i) => i.id));
  return library.filter((it) => pool.has(it.id) || lockedIds.has(it.id));
}
