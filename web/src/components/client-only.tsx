"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * Renders its children in the browser only. App pages depend on the visitor's Arc network (a choice stored in
 * the browser that server-rendered HTML can't know), so they draw right after hydration instead of flashing the
 * other network. In-app navigation renders them straight away.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const browser = useSyncExternalStore(subscribe, () => true, () => false);
  return browser ? children : <AppSkeleton />;
}

function AppSkeleton() {
  return (
    <div className="shell" aria-busy="true">
      <header className="appbar" />
      <main className="container page"><div className="skeleton" style={{ height: 360 }} /></main>
    </div>
  );
}
