/*
 * One-shot session-range migrations, called from Dexie .upgrade() blocks.
 * Kept separate from schema.ts so the rewrite logic is unit-testable
 * without touching IndexedDB.
 */

import type { SlotKey, SlotRange } from '../shared/slots';
import { DEFAULT_SLOT_RANGES } from '../shared/slots';

/**
 * Defaults that v1 sessions were created with. Untouched sessions
 * match this exactly; matching → "user never opened the panel."
 *
 * Frozen here intentionally — DO NOT replace with imports. The whole
 * point of the snapshot is that future changes to DEFAULT_SLOT_RANGES
 * don't retroactively reclassify already-migrated sessions.
 */
export const V1_DEFAULTS: Record<SlotKey, SlotRange> = {
  top: { min: 1, max: 2 },
  outerwear: { min: 0, max: 1 },
  bottom: { min: 0, max: 1 },
  full_body: { min: 0, max: 1 },
  shoes: { min: 1, max: 1 },
  accessories: { min: 0, max: 2 },
  other: { min: 0, max: 1 },
};

function rangesEqual(
  a: Record<SlotKey, SlotRange>,
  b: Record<SlotKey, SlotRange>,
): boolean {
  for (const slot of Object.keys(a) as SlotKey[]) {
    if (a[slot].min !== b[slot].min || a[slot].max !== b[slot].max) return false;
  }
  return true;
}

/**
 * Transform v1 session ranges into v2 ranges.
 *
 * - Untouched sessions (exactly the v1 defaults) → replace wholesale with
 *   the new defaults. These users never customized; semantics changed.
 * - Customized sessions → minimum semantic correction: floor bottom.min and
 *   full_body.min at 1 (under v1 they were workarounds for the missing
 *   shape XOR; under v2 they produce broken outfits).
 * - max is clamped above min in case a customized session had weird state.
 */
export function migrateSessionRanges(
  ranges: Record<SlotKey, SlotRange>,
): Record<SlotKey, SlotRange> {
  if (rangesEqual(ranges, V1_DEFAULTS)) {
    return { ...DEFAULT_SLOT_RANGES };
  }
  const next: Record<SlotKey, SlotRange> = { ...ranges };
  next.bottom = {
    min: Math.max(1, ranges.bottom.min),
    max: Math.max(Math.max(1, ranges.bottom.min), ranges.bottom.max),
  };
  next.full_body = {
    min: Math.max(1, ranges.full_body.min),
    max: Math.max(Math.max(1, ranges.full_body.min), ranges.full_body.max),
  };
  return next;
}
