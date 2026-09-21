import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  onLogout: () => void;
  children: ReactNode;
  topbar?: {
    title: string;
    description: string;
    breadcrumb?: string;
    systemStatus?: "online" | "warning" | "error";
    systemStatusLabel?: string;
    modelVersion?: string;
    notificationsCount?: number;
    userName?: string;
    userRole?: string;
  };
}

export function AppShell({
  onLogout,
  children,
  topbar,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-bg text-slate-100">
      <Sidebar onLogout={onLogout} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          title={topbar?.title ?? "PHOENIX"}
          description={topbar?.description ?? ""}
          breadcrumb={topbar?.breadcrumb}
          systemStatus={topbar?.systemStatus}
          systemStatusLabel={topbar?.systemStatusLabel}
          modelVersion={topbar?.modelVersion}
          notificationsCount={topbar?.notificationsCount}
          userName={topbar?.userName}
          userRole={topbar?.userRole}
        />
        <main className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}