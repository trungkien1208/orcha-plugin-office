import type { OfficeState } from "@easy-job/shared";

/**
 * Names for new Agents, from the office's cast ("Headset", "Red Cap", …): ones no Agent uses come first, in cast
 * order; when all are taken, a number is added ("Headset 2"). `skip` moves past names already offered.
 */
export function suggestNames(office: OfficeState | null | undefined, count = 1, skip = 0): string[] {
  const cast = office?.catalog.skins.map((skin) => skin.name).filter(Boolean) ?? [];
  const pool = cast.length ? cast : ["Agent"];
  const used = new Set((office?.agents ?? []).map((agent) => agent.name.toLowerCase()));
  const names: string[] = [];
  for (let round = 1; names.length < skip + count && round < 100; round += 1) {
    for (const base of pool) {
      const name = round === 1 ? base : `${base} ${round}`;
      if (!used.has(name.toLowerCase())) names.push(name);
      if (names.length >= skip + count) break;
    }
  }
  return names.slice(skip, skip + count);
}
