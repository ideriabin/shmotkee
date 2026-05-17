import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { generate } from './generator';
import { DEFAULT_SLOT_RANGES, type SlotKey } from '../shared/slots';
import type { Item } from '../shared/types';

function makeItem(id: string, slot: SlotKey): Item {
  return {
    id,
    name: id,
    slot,
    zPriority: 0,
    blob: new Blob(),
    thumbnail: new Blob(),
    createdAt: 0,
  };
}

function collect(opts: Parameters<typeof generate>[0], limit = 200) {
  const out: ReturnType<typeof generate> extends Generator<infer T> ? T[] : never = [];
  const gen = generate(opts);
  for (let i = 0; i < limit; i++) {
    const next = gen.next();
    if (next.done) break;
    out.push(next.value);
  }
  return out;
}

describe('outfit generator — shape XOR', () => {
  beforeEach(() => {
    // Seed Math.random with a deterministic LCG so combinatorial coverage
    // doesn't flake between runs.
    let s = 1;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x1_0000_0000;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never emits a combination with both full_body and top/bottom', () => {
    const library: Item[] = [
      makeItem('top-1', 'top'),
      makeItem('top-2', 'top'),
      makeItem('bottom-1', 'bottom'),
      makeItem('bottom-2', 'bottom'),
      makeItem('dress-1', 'full_body'),
      makeItem('dress-2', 'full_body'),
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [],
      slotRanges: DEFAULT_SLOT_RANGES,
      seenKeys: new Set(),
    });

    expect(results.length).toBeGreaterThan(0);
    for (const c of results) {
      const hasOnePiece = c.bySlot.full_body.length > 0;
      const hasSeparates = c.bySlot.top.length > 0 || c.bySlot.bottom.length > 0;
      expect(hasOnePiece && hasSeparates).toBe(false);
    }
  });

  it('produces both shapes when both are available', () => {
    const library: Item[] = [
      makeItem('top-1', 'top'),
      makeItem('bottom-1', 'bottom'),
      makeItem('dress-1', 'full_body'),
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [],
      slotRanges: DEFAULT_SLOT_RANGES,
      seenKeys: new Set(),
    });

    const onePieceCount = results.filter((c) => c.bySlot.full_body.length > 0).length;
    const separatesCount = results.filter(
      (c) => c.bySlot.top.length > 0 && c.bySlot.bottom.length > 0,
    ).length;
    expect(onePieceCount).toBeGreaterThan(0);
    expect(separatesCount).toBeGreaterThan(0);
  });

  it('locked full_body forces one_piece shape (no top/bottom in result)', () => {
    const dress = makeItem('dress-1', 'full_body');
    const library: Item[] = [
      makeItem('top-1', 'top'),
      makeItem('bottom-1', 'bottom'),
      dress,
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [dress],
      slotRanges: DEFAULT_SLOT_RANGES,
      seenKeys: new Set(),
    });

    expect(results.length).toBeGreaterThan(0);
    for (const c of results) {
      expect(c.bySlot.full_body.map((i) => i.id)).toContain('dress-1');
      expect(c.bySlot.top).toHaveLength(0);
      expect(c.bySlot.bottom).toHaveLength(0);
    }
  });

  it('locked top forces separates shape (no dresses in result)', () => {
    const top = makeItem('top-1', 'top');
    const library: Item[] = [
      top,
      makeItem('bottom-1', 'bottom'),
      makeItem('dress-1', 'full_body'),
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [top],
      slotRanges: DEFAULT_SLOT_RANGES,
      seenKeys: new Set(),
    });

    expect(results.length).toBeGreaterThan(0);
    for (const c of results) {
      expect(c.bySlot.top.map((i) => i.id)).toContain('top-1');
      expect(c.bySlot.full_body).toHaveLength(0);
    }
  });

  it('locked dress + locked top → dress wins, top is dropped', () => {
    const dress = makeItem('dress-1', 'full_body');
    const strayTop = makeItem('top-1', 'top');
    const library: Item[] = [
      dress,
      strayTop,
      makeItem('bottom-1', 'bottom'),
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [dress, strayTop],
      slotRanges: DEFAULT_SLOT_RANGES,
      seenKeys: new Set(),
    });

    expect(results.length).toBeGreaterThan(0);
    for (const c of results) {
      expect(c.bySlot.full_body.map((i) => i.id)).toContain('dress-1');
      expect(c.bySlot.top).toHaveLength(0);
    }
  });
});
