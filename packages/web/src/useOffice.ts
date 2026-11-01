import { useSyncExternalStore } from "react";
import { getSnap, subscribe, type AppSnap } from "./store.ts";

export function useOffice(): AppSnap {
  return useSyncExternalStore(subscribe, getSnap, getSnap);
}
