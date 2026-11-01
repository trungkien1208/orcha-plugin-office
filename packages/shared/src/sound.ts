/** True when this sound is allowed to play. Remembers the time so a burst shares one play. */
export function allowSound(last: Map<string, number>, name: string, now: number, gapMs = 2000): boolean {
  const previous = last.get(name);
  if (previous != null && now - previous < gapMs) return false;
  last.set(name, now);
  return true;
}
