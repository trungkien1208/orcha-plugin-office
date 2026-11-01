/** Frame geometry is capped by both the manifest and the actual PNG. */
export function frameCount(width: number, height: number, fw = 48, fh = 72, columns = 4, rows = 9): number {
  return Math.max(1, Math.min(Math.floor(width / fw), columns) * Math.min(Math.floor(height / fh), rows));
}
export function nearestFrame(requested: number, available: readonly number[]): number {
  if (available.includes(requested)) return requested;
  // A missing shock must remain a readable standing worker, never an unrelated nap/spare.
  if (requested >= 32 && requested <= 33 && available.includes(26)) return 26;
  return available.reduce((best, frame) => Math.abs(frame - requested) < Math.abs(best - requested) ? frame : best, available[0] ?? 0);
}
