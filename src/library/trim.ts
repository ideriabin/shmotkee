/*
 * Alpha-based bounding-box trim for transparent PNG uploads.
 *
 * Many product photos arrive with significant transparent margin around
 * the garment, which shrinks the visible item inside its preview cell.
 * This utility decodes the bitmap, finds the tight bounds of non-
 * transparent pixels (alpha > threshold), and returns a cropped PNG
 * with a small padding margin. Idempotent — re-running on an already-
 * tight image is a no-op and returns the original Blob.
 *
 * Bails to the original Blob (no allocation) when:
 *  - the image is fully opaque (no alpha channel signal at all)
 *  - the image is fully transparent
 *  - bounds already cover the full canvas (already tight)
 *  - decoding fails
 */

export type TrimOptions = {
  alphaThreshold?: number; // 0–255; pixels with alpha > this count as content
  paddingPct?: number; // % of long edge added around bounds
};

export async function trimTransparent(
  blob: Blob,
  opts: TrimOptions = {},
): Promise<Blob> {
  const alphaThreshold = opts.alphaThreshold ?? 16;
  const paddingPct = opts.paddingPct ?? 2;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  const w = bitmap.width;
  const h = bitmap.height;

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? (new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement)
      : (() => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          return c;
        })();
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  const bounds = findContentBounds(data, w, h, alphaThreshold);

  bitmap.close();

  if (!bounds.sawTransparent) return blob; // fully opaque (e.g. JPEG-as-PNG)
  if (bounds.maxX < 0) return blob; // fully transparent
  if (
    bounds.minX === 0 &&
    bounds.minY === 0 &&
    bounds.maxX === w - 1 &&
    bounds.maxY === h - 1
  ) {
    return blob; // already tight
  }

  const { cropX, cropY, cropW, cropH } = computeCropRect(bounds, w, h, paddingPct);

  const out =
    typeof OffscreenCanvas !== 'undefined'
      ? (new OffscreenCanvas(cropW, cropH) as unknown as HTMLCanvasElement)
      : (() => {
          const c = document.createElement('canvas');
          c.width = cropW;
          c.height = cropH;
          return c;
        })();
  const octx = out.getContext('2d') as CanvasRenderingContext2D | null;
  if (!octx) return blob;
  octx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  if (typeof OffscreenCanvas !== 'undefined' && out instanceof OffscreenCanvas) {
    return await (out as unknown as OffscreenCanvas).convertToBlob({ type: 'image/png' });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (out as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
}

/**
 * Pure: scan RGBA pixel data and return the bounding box of pixels whose
 * alpha exceeds `alphaThreshold`. Exposed for unit tests so the pixel math
 * is verifiable without a Canvas runtime.
 *
 * `maxX < 0` means no pixel passed the threshold (fully transparent).
 * `sawTransparent` flags whether any pixel had alpha < 255 — used to bail
 * on fully-opaque images that have no transparent margin to trim.
 */
export function findContentBounds(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number,
): { minX: number; minY: number; maxX: number; maxY: number; sawTransparent: boolean } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sawTransparent = false;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const a = data[(row + x) * 4 + 3]!;
      if (a < 255) sawTransparent = true;
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, sawTransparent };
}

/** Pure: bounds + padding → final crop rect clamped to image dimensions. */
export function computeCropRect(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  width: number,
  height: number,
  paddingPct: number,
): { cropX: number; cropY: number; cropW: number; cropH: number } {
  const padPx = Math.max(1, Math.round((Math.max(width, height) * paddingPct) / 100));
  const cropX = Math.max(0, bounds.minX - padPx);
  const cropY = Math.max(0, bounds.minY - padPx);
  const cropW = Math.min(width, bounds.maxX + 1 + padPx) - cropX;
  const cropH = Math.min(height, bounds.maxY + 1 + padPx) - cropY;
  return { cropX, cropY, cropW, cropH };
}
