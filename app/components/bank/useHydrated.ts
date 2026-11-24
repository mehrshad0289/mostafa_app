"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** true فقط پس از hydration؛ در prerender و رندر اولیه کلاینت false است */
export function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
