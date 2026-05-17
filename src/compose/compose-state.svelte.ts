/*
 * Compose tab state — active session, library pool, current generator,
 * accumulated results, and Tinder view position. Lives at module scope
 * so it survives tab switches within the same browsing session.
 *
 * Subset (`session.subsetIds`) restricts the generator's source pool to
 * the listed items. There's no separate "lock" concept — to force a
 * single item into every outfit, include just it in its slot within
 * the subset (the generator picks 1 from a 1-item pool every time).
 */

import type { Combination, Item, Session } from '../shared/types';
import { generate } from './generator';

export const composeState = $state({
  session: null as Session | null,
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
  const lib = applySubset(composeState.library, composeState.session.subsetIds);
  currentGenerator = generate({
    library: lib,
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
 * Non-empty subset → keep only items in the subset.
 */
export function applySubset(library: Item[], subsetIds: string[] | null): Item[] {
  if (!subsetIds || subsetIds.length === 0) return library;
  const pool = new Set(subsetIds);
  return library.filter((it) => pool.has(it.id));
}
