import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  ArrowLeftRight,
  ShieldAlert,
  GitBranch,
  Activity,
  BrainCog,
  ScrollText,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { PhoenixLogo } from "../PhoenixLogo";

interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Pages that exist and are routable. Items without a path are placeholders. */
  path?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Datasets", icon: Database, path: "/dataset" },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Fraud Detection", icon: ShieldAlert },
  { label: "Schema Evolution", icon: GitBranch },
  { label: "Concept Drift", icon: Activity },
  { label: "Adaptive Learning", icon: BrainCog },
  { label: "Activity Logs", icon: ScrollText },
  { label: "Settings", icon: Settings },
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

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
          const isActive = path ? location.pathname === path : false;
          return (
            <button
              key={label}
              onClick={() => path && navigate(path)}
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
