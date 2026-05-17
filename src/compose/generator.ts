/*
 * Outfit combination generator — pure, no DOM, no I/O.
 *
 * Yields unique combinations lazily until the seen-set covers all
 * reachable combinations under current constraints. Both the grid
 * (pulls 30 per page) and the Tinder view (pulls 1 at a time) consume
 * from the same generator instance.
 *
 * Each sample first picks an outfit *shape* (separates vs one-piece —
 * see OUTFIT_SHAPES). Only the shape's active slots are sampled; the
 * rest stay empty. This enforces the XOR between a dress/jumpsuit and
 * the top+bottom pair without a post-hoc rejection pass.
 */

import {
  SLOT_KEYS,
  SLOT_RENDER_ORDER,
  OUTFIT_SHAPES,
  type OutfitShape,
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

  // Group library by slot. Unclassified items (slot === null) are silently
  // excluded from generation.
  const bySlot: Record<SlotKey, Item[]> = emptyBySlot();
  for (const item of library) {
    if (item.slot !== null) bySlot[item.slot].push(item);
  }

  // Locked items by slot. (Unclassified items shouldn't be lockable; lock
  // picker filters them out.)
  const lockedBySlot: Record<SlotKey, Item[]> = emptyBySlot();
  for (const item of locked) {
    if (item.slot !== null) lockedBySlot[item.slot].push(item);
  }

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
  const shape = pickShape(unlocked, lockedBySlot, ranges);
  if (!shape) return null;

  const active = new Set<SlotKey>(shape.slots);
  const result: Record<SlotKey, Item[]> = emptyBySlot();
  let totalCount = 0;

  for (const slot of SLOT_KEYS) {
    // Inactive slot in this shape: drop locks (they conflict with the
    // chosen shape and the user gets a coherent outfit anyway).
    if (!active.has(slot)) continue;

    const range = ranges[slot];
    const lockedHere = lockedBySlot[slot];
    const pool = unlocked[slot];
    const lockedCount = lockedHere.length;

    if (lockedCount >= range.max) {
      const sliced = lockedHere.slice(0, range.max);
      result[slot] = sortByZ(sliced);
      totalCount += sliced.length;
      continue;
    }

    const effectiveMin = Math.max(0, range.min - lockedCount);
    const effectiveMax = Math.min(range.max - lockedCount, pool.length);

    if (effectiveMax < effectiveMin) {
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

  if (totalCount === 0) return null;

  return { bySlot: result, key: makeKey(result) };
}

/**
 * Choose an outfit shape. Forced by locks when possible; otherwise
 * weighted by how many distinct combinations each shape could yield
 * from the current library — so a wardrobe of 20 tops and 2 dresses
 * produces mostly separates, not 50/50.
 */
function pickShape(
  unlocked: Record<SlotKey, Item[]>,
  lockedBySlot: Record<SlotKey, Item[]>,
  ranges: Record<SlotKey, SlotRange>,
): OutfitShape | null {
  const forced = forcedShapeFromLocks(lockedBySlot);
  if (forced) {
    return shapeCanProduce(forced, unlocked, lockedBySlot, ranges) ? forced : null;
  }

  const weighted: { shape: OutfitShape; weight: number }[] = [];
  for (const shape of OUTFIT_SHAPES) {
    if (!shapeCanProduce(shape, unlocked, lockedBySlot, ranges)) continue;
    const w = shapeWeight(shape, unlocked, lockedBySlot);
    if (w > 0) weighted.push({ shape, weight: w });
  }
  if (weighted.length === 0) return null;

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  let pick = Math.random() * total;
  for (const w of weighted) {
    pick -= w.weight;
    if (pick <= 0) return w.shape;
  }
  return weighted[weighted.length - 1]!.shape;
}

/**
 * If the user locked items that only fit one shape, return that shape.
 * If locks straddle both shapes (e.g. dress + top), prefer the shape
 * with more locked items so the user's stronger intent wins; ties go
 * to one_piece (a dress is a bigger commitment than a single top).
 */
function forcedShapeFromLocks(
  lockedBySlot: Record<SlotKey, Item[]>,
): OutfitShape | null {
  const onePieceLocks = lockedBySlot.full_body.length;
  const separatesLocks = lockedBySlot.top.length + lockedBySlot.bottom.length;
  if (onePieceLocks === 0 && separatesLocks === 0) return null;
  if (onePieceLocks > 0 && separatesLocks === 0) return shapeById('one_piece');
  if (separatesLocks > 0 && onePieceLocks === 0) return shapeById('separates');
  return onePieceLocks >= separatesLocks ? shapeById('one_piece') : shapeById('separates');
}

function shapeById(id: OutfitShape['id']): OutfitShape {
  return OUTFIT_SHAPES.find((s) => s.id === id)!;
}

/**
 * Can this shape produce at least one valid outfit given the pool and locks?
 * For each active slot we need (locked + unlocked count) ≥ min.
 */
function shapeCanProduce(
  shape: OutfitShape,
  unlocked: Record<SlotKey, Item[]>,
  lockedBySlot: Record<SlotKey, Item[]>,
  ranges: Record<SlotKey, SlotRange>,
): boolean {
  for (const slot of shape.slots) {
    const available = unlocked[slot].length + lockedBySlot[slot].length;
    if (available < ranges[slot].min) return false;
  }
  return true;
}

/**
 * Rough combinatorial weight: product of available counts across the
 * shape's "distinguishing" slots (the ones not shared with other shapes).
 * Shared slots (outerwear, shoes, accessories, other) would multiply
 * both shapes' weights equally and don't affect proportions, so we omit
 * them. Caps each slot at 1 minimum to avoid zeroing out from an
 * accessory-only slot.
 */
function shapeWeight(
  shape: OutfitShape,
  unlocked: Record<SlotKey, Item[]>,
  lockedBySlot: Record<SlotKey, Item[]>,
): number {
  const distinguishing: SlotKey[] =
    shape.id === 'separates' ? ['top', 'bottom'] : ['full_body'];
  let w = 1;
  for (const slot of distinguishing) {
    const n = unlocked[slot].length + lockedBySlot[slot].length;
    w *= Math.max(0, n);
  }
  return w;
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
