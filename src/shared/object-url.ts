/*
 * Manage URL.createObjectURL lifecycle. Caller passes a blob; gets a URL
 * and a revoke function. Centralizes the createObjectURL/revokeObjectURL
 * pair so we don't leak blob URLs across the app.
 */

export function makeObjectUrl(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob);
  let revoked = false;
  return {
    url,
    revoke() {
      if (revoked) return;
      URL.revokeObjectURL(url);
      revoked = true;
    },
  };
}
