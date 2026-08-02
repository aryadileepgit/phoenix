import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Shared page frame (sidebar + top navbar + scrollable content well) used by
 * every authenticated screen so the theme, spacing, and chrome stay identical
 * across Dashboard, Dataset Management, and any future pages.
 */
export function AppShell({ onLogout, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-bg text-slate-100">
      <Sidebar onLogout={onLogout} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
