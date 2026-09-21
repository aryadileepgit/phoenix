import { Bell, ChevronDown, CheckCircle2, XCircle, CreditCard } from "lucide-react";

interface TopbarProps {
  title: string;
  description: string;
  breadcrumb?: string;
  systemStatus?: "online" | "warning" | "error";
  systemStatusLabel?: string;
  modelVersion?: string;
  notificationsCount?: number;
  userName?: string;
  userRole?: string;
}

export function Topbar({
  title,
  description,
  breadcrumb,
  systemStatus = "online",
  systemStatusLabel = "Phoenix Engine Online",
  modelVersion = "XGBoost v2.4.1",
  notificationsCount = 0,
  userName = "Administrator",
  userRole = "Admin",
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-card-border bg-bg/80 px-6 py-4 backdrop-blur">
      <div className="flex-1 min-w-0">
        {breadcrumb && (
          <p className="text-xs text-faint mb-1">{breadcrumb}</p>
        )}
        <h1 className="text-xl font-bold text-slate-50 truncate">{title}</h1>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium md:flex"
          style={{ borderColor: `var(--color-${systemStatus === "online" ? "success" : systemStatus === "warning" ? "warning" : "danger"})/25` }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full"
            style={{ backgroundColor: `var(--color-${systemStatus === "online" ? "success" : systemStatus === "warning" ? "warning" : "danger"})` }} />
          {systemStatusLabel}
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-slate-300 md:flex">
          {modelVersion}
          <ChevronDown size={13} className="text-faint" />
        </div>

        <button className="relative rounded-full border border-card-border bg-card p-2.5 text-slate-300 transition-colors hover:text-primary">
          <Bell size={16} />
          {notificationsCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {notificationsCount > 9 ? "9+" : notificationsCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 rounded-full border border-card-border bg-card py-1.5 pl-1.5 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <span className="hidden text-xs font-semibold sm:inline">{userName}</span>
          <span className="hidden text-[10px] text-faint sm:inline">({userRole})</span>
          <ChevronDown size={13} className="hidden text-faint sm:inline" />
        </div>
      </div>
    </header>
  );
}