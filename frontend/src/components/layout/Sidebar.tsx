import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Database, ArrowLeftRight, Link, Search, Network, GitBranch, Activity, BrainCog, TrendingUp, ScrollText, Settings, LogOut, type LucideIcon, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { PhoenixLogo } from "../PhoenixLogo";

interface NavGroup {
  title: string;
  items: { label: string; icon: LucideIcon; path: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "COMMAND CENTER",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    title: "DATA",
    items: [
      { label: "Dataset", icon: Database, path: "/dataset" },
      { label: "Transactions", icon: ArrowLeftRight, path: "/transactions" },
      { label: "Accounts", icon: Link, path: "/accounts" },
    ],
  },
  {
    title: "INVESTIGATION",
    items: [
      { label: "Investigation", icon: Search, path: "/investigation" },
      { label: "Network Analysis", icon: Network, path: "/network-analysis" },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Schema Evolution", icon: GitBranch, path: "/schema-registry" },
      { label: "Concept Drift", icon: Activity, path: "/drift-monitoring" },
      { label: "Adaptive Retraining", icon: BrainCog, path: "/adaptive-learning" },
      { label: "Model Performance", icon: TrendingUp, path: "/model-performance" },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Activity", icon: ScrollText, path: "/activity" },
      { label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
];

interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    onLogout();
    navigate("/");
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-card-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <PhoenixLogo size={30} />
        <span className="text-lg font-extrabold tracking-tight text-gradient-phoenix">
          PHOENIX
        </span>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-faint">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ label, icon: Icon, path }) => {
                const isActive = location.pathname === path;
                return (
                  <button
                    key={label}
                    onClick={() => navigate(path)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    <Icon size={17} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-card-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </aside>
  );
}