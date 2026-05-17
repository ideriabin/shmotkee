import { describe, expect, it } from 'vitest';
import { findContentBounds, computeCropRect } from './trim';

/**
 * Build an RGBA buffer of width × height where pixels in `mask` are opaque
 * (alpha 255) and everything else is fully transparent (alpha 0).
 */
function buildPixels(width: number, height: number, mask: (x: number, y: number) => boolean): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const opaque = mask(x, y);
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = opaque ? 255 : 0;
    }
  }
  return data;
}

describe('findContentBounds', () => {
  it('locates a centered opaque rectangle inside a transparent canvas', () => {
    // 10×10 canvas, opaque block from (3,2) to (6,7) inclusive.
    const data = buildPixels(10, 10, (x, y) => x >= 3 && x <= 6 && y >= 2 && y <= 7);
    const b = findContentBounds(data, 10, 10, 16);
    expect(b).toEqual({ minX: 3, minY: 2, maxX: 6, maxY: 7, sawTransparent: true });
  });

  it('returns no-content bounds for a fully transparent canvas', () => {
    const data = buildPixels(8, 8, () => false);
    const b = findContentBounds(data, 8, 8, 16);
    expect(b.maxX).toBe(-1);
    expect(b.sawTransparent).toBe(true);
  });

  it('flags sawTransparent=false when no pixel has alpha < 255', () => {
    const data = buildPixels(4, 4, () => true);
    const b = findContentBounds(data, 4, 4, 16);
    expect(b.sawTransparent).toBe(false);
    expect(b).toMatchObject({ minX: 0, minY: 0, maxX: 3, maxY: 3 });
  });

  it('respects the alpha threshold (semi-transparent edges below threshold are ignored)', () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    // Center fully opaque, edges at alpha=10 (below default 16).
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const i = (y * 3 + x) * 4;
        data[i + 3] = x === 1 && y === 1 ? 255 : 10;
      }
    }
    const b = findContentBounds(data, 3, 3, 16);
    expect(b).toEqual({ minX: 1, minY: 1, maxX: 1, maxY: 1, sawTransparent: true });
  });
});

describe('computeCropRect', () => {
  it('adds padding from paddingPct of long edge, clamped to image bounds', () => {
    const r = computeCropRect({ minX: 30, minY: 40, maxX: 70, maxY: 90 }, 100, 200, 5);
    // padPx = round(200 * 5 / 100) = 10
    expect(r.cropX).toBe(20); // 30 - 10
    expect(r.cropY).toBe(30); // 40 - 10
    expect(r.cropW).toBe(61); // min(100, 70+1+10) - 20 = 81 - 20
    expect(r.cropH).toBe(71); // min(200, 90+1+10) - 30 = 101 - 30
  });

  it('produces at least 1px of padding even at tiny paddingPct', () => {
    const r = computeCropRect({ minX: 1, minY: 1, maxX: 1, maxY: 1 }, 4, 4, 0);
    // 0% would round to 0 — floor at 1px so the crop is never literally
    // flush against the content edge.
    expect(r.cropX).toBe(0);
    expect(r.cropY).toBe(0);
    expect(r.cropW).toBe(3); // maxX+1+1 = 3, cropped from cropX=0
    expect(r.cropH).toBe(3);
  });

  it('clamps right/bottom to image dimensions', () => {
    const r = computeCropRect({ minX: 0, minY: 0, maxX: 99, maxY: 99 }, 100, 100, 5);
    expect(r.cropW).toBe(100);
    expect(r.cropH).toBe(100);
  });
});
