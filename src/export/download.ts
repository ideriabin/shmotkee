/*
 * Trigger downloads for single and bulk exports.
 *
 * Single PNG: a quick anchor + click pattern.
 * Bulk ZIP: jszip, lazy-loaded chunk (only fetched when used).
 */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the download a moment to register before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAsZip(
  files: { name: string; blob: Blob }[],
  zipName: string,
): Promise<void> {
  // Lazy chunk — keeps jszip out of the main bundle until export is used.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, zipName);
}
