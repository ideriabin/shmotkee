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

describe('outfit generator', () => {
  beforeEach(() => {
    let s = 1;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x1_0000_0000;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces unique combinations and exhausts cleanly', () => {
    const library: Item[] = [
      makeItem('top-1', 'top'),
      makeItem('top-2', 'top'),
      makeItem('bottom-1', 'bottom'),
      makeItem('shoes-1', 'shoes'),
    ];
    const seen = new Set<string>();
    const results = collect({
      library,
      locked: [],
      slotRanges: { ...DEFAULT_SLOT_RANGES, bottom: { min: 1, max: 1 } },
      seenKeys: seen,
    });
    expect(results.length).toBeGreaterThan(0);
    const keys = new Set(results.map((r) => r.key));
    expect(keys.size).toBe(results.length);
  });

  it('honors slot ranges (locked items always present)', () => {
    const top = makeItem('top-1', 'top');
    const library: Item[] = [
      top,
      makeItem('top-2', 'top'),
      makeItem('bottom-1', 'bottom'),
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [top],
      slotRanges: { ...DEFAULT_SLOT_RANGES, bottom: { min: 1, max: 1 } },
      seenKeys: new Set(),
    });
    for (const c of results) {
      expect(c.bySlot.top.map((i) => i.id)).toContain('top-1');
    }
  });

  it('permits dress + top + bottom in the same outfit (no XOR constraint)', () => {
    const library: Item[] = [
      makeItem('top-1', 'top'),
      makeItem('bottom-1', 'bottom'),
      makeItem('dress-1', 'full_body'),
      makeItem('shoes-1', 'shoes'),
    ];
    const results = collect({
      library,
      locked: [],
      slotRanges: {
        top: { min: 1, max: 1 },
        bottom: { min: 1, max: 1 },
        full_body: { min: 1, max: 1 },
        outerwear: { min: 0, max: 0 },
        shoes: { min: 1, max: 1 },
        accessories: { min: 0, max: 0 },
        other: { min: 0, max: 0 },
      },
      seenKeys: new Set(),
    });
    expect(results.length).toBeGreaterThan(0);
    for (const c of results) {
      expect(c.bySlot.top.length).toBe(1);
      expect(c.bySlot.bottom.length).toBe(1);
      expect(c.bySlot.full_body.length).toBe(1);
    }
  });

  it('returns no combinations when library is empty', () => {
    const results = collect({
      library: [],
      locked: [],
      slotRanges: DEFAULT_SLOT_RANGES,
      seenKeys: new Set(),
    });
    expect(results.length).toBe(0);
  });
});
