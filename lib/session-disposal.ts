/** Disconnect a Prisma client before removing its SQLite file.
 * Keeping this ordering outside Next.js lets us regression-test it directly.
 */
export async function disconnectThenRemove(
  disconnect: () => Promise<void>,
  remove: () => Promise<void>,
): Promise<void> {
  await disconnect();
  await remove();
}
