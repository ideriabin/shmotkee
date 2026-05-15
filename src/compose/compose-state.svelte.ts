/*
 * Compose tab state — active session, locked items, current generator,
 * accumulated results, and Tinder view position. Lives at module scope
 * so it survives tab switches within the same browsing session.
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
  currentGenerator = generate({
    library: composeState.library,
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
