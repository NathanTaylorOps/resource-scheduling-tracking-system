/**
 * Client-side photo compression for scan condition photos. Runs entirely in
 * the browser before an image ever leaves the device — for a tool designed
 * to clone-and-run against a local SQLite file rather than a hosted object
 * store, keeping the payload small at the source is what makes storing the
 * photo directly on the scan record practical instead of standing up a
 * separate media service for a proof-of-concept.
 */
export async function compressImageFile(
  file: File,
  maxDimensionPx = 1280,
  quality = 0.72,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimensionPx / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot process photos for upload.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}
