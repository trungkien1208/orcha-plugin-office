import { emptyLocal, floorNeedsMigration, migrateFloor, type LocalState, type SavedFloor } from "@easy-job/shared";
import { getCatalog } from "./catalog.ts";
import fs from "node:fs";
import path from "node:path";

export type LocalStore = {
  get(): LocalState;
  update(mutate: (local: LocalState) => void): LocalState;
  file: string;
};

export function localFile(home = defaultHome()): string {
  return path.join(home, "state.json");
}

export function defaultHome(): string {
  return process.env.EASY_JOB_HOME ?? process.env.ORCHA_OFFICE_HOME ?? easyJobHome();
}

function easyJobHome(): string {
  const home = process.env.HOME ?? ".";
  const next = path.join(home, ".easy-job");
  const previous = path.join(home, ".orcha-office");
  if (!fs.existsSync(next) && fs.existsSync(previous)) return previous;
  return next;
}

export function loadLocal(file: string): LocalStore {
  const state = read(file);
  return {
    file,
    get: () => state,
    update(mutate) {
      mutate(state);
      writeAtomic(file, state);
      return state;
    },
  };
}

function read(file: string): LocalState {
  try {
    const text = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(text) as Partial<LocalState> & { floor?: unknown };
    if (parsed.version !== 1 || !parsed.seen || !parsed.floor) return emptyLocal();
    const state: LocalState = {
      version: 1,
      seen: parsed.seen,
      skins: parsed.skins ?? {},
      waitingSince: parsed.waitingSince ?? {},
      floor: migrateFloor(parsed.floor),
    };
    if (floorNeedsMigration(parsed.floor)) writeAtomic(file, state);
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Easy Job could not read ${file}; starting with empty local state`);
    }
    return emptyLocal();
  }
}

export function normalizeFloor(floor: unknown): SavedFloor {
  return migrateFloor(floor);
}

export function writeAtomic(file: string, state: LocalState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state)}\n`);
  fs.renameSync(tmp, file);
}

export function isSkinId(value: string): boolean {
  const catalog = getCatalog();
  return catalog.skins.some((skin) => skin.id === value);
}
