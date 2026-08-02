import { Search, Bell, ChevronDown } from "lucide-react";
import { PhoenixLogo } from "../PhoenixLogo";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-card-border bg-bg/80 px-6 py-4 backdrop-blur">
      <div className="hidden max-w-md flex-1 items-center gap-2 rounded-xl border border-card-border bg-card/60 px-3.5 py-2.5 sm:flex">
        <Search size={16} className="text-faint" />
        <input
          placeholder="Search transactions, datasets, alerts…"
          className="w-full bg-transparent text-sm text-slate-200 placeholder:text-faint outline-none"
        />
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <PhoenixLogo size={26} />
        <span className="text-sm font-extrabold text-gradient-phoenix">PHOENIX</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-xs font-medium text-success md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          System Healthy
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-slate-300 md:flex">
          XGBoost v2.4.1
          <ChevronDown size={13} className="text-faint" />
        </div>

        <button className="relative rounded-full border border-card-border bg-card p-2.5 text-slate-300 transition-colors hover:text-primary">
          <Bell size={16} />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            3
          </span>
        </button>

        <div className="flex items-center gap-2 rounded-full border border-card-border bg-card py-1.5 pl-1.5 pr-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            AD
          </div>
          <span className="hidden text-xs font-semibold sm:inline">Administrator</span>
          <ChevronDown size={13} className="hidden text-faint sm:inline" />
        </div>
      </div>
    </header>
  );
}
