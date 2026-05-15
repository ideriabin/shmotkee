/*
 * Generate a small thumbnail blob from an image blob.
 *
 * Long-edge cap: 320px. PNG output preserves transparency (her uploads
 * should be transparent flat-lay PNGs, per the visual direction).
 * Done off-main-thread when OffscreenCanvas is available (most modern
 * browsers); falls back to an in-DOM <canvas> when not.
 */

const MAX_EDGE = 320;

export async function generateThumbnail(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, MAX_EDGE);

    if (typeof OffscreenCanvas !== 'undefined') {
      const oc = new OffscreenCanvas(width, height);
      const ctx = oc.getContext('2d');
      if (!ctx) throw new Error('2d context unavailable on OffscreenCanvas');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, width, height);
      return await oc.convertToBlob({ type: 'image/png' });
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (out) => (out ? resolve(out) : reject(new Error('canvas.toBlob returned null'))),
        'image/png',
      );
    });
  } finally {
    bitmap.close();
  }
}

function scaleToFit(w: number, h: number, edge: number): { width: number; height: number } {
  if (w <= edge && h <= edge) return { width: w, height: h };
  if (w >= h) {
    return { width: edge, height: Math.round((h * edge) / w) };
  }
  return { width: Math.round((w * edge) / h), height: edge };
}

export function filenameStem(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}
