import { motion } from "framer-motion";
import {
  Database as DatabaseIcon,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  FileStack,
  RefreshCcw,
  AlertTriangle,
  Activity,
  GitBranch,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppShell } from "../components/layout/AppShell";

interface DashboardProps {
  onLogout: () => void;
}

const TREND_DATA = [
  { day: "May 10", volume: 1150, fraud: 320 },
  { day: "May 11", volume: 1780, fraud: 480 },
  { day: "May 12", volume: 1420, fraud: 390 },
  { day: "May 13", volume: 2200, fraud: 610 },
  { day: "May 14", volume: 1080, fraud: 260 },
  { day: "May 15", volume: 1960, fraud: 540 },
  { day: "May 16", volume: 2480, fraud: 700 },
];

const PIE_DATA = [
  { name: "Legitimate", value: 94.2, amount: "1.17M", color: "#F97316" },
  { name: "Fraudulent", value: 5.8, amount: "72.4K", color: "#EF4444" },
];

const DRIFT_EVENTS = [
  { field: "transaction_location", severity: "Medium", time: "1 hour ago" },
  { field: "merchant_category", severity: "Low", time: "5 hours ago" },
  { field: "device_fingerprint", severity: "High", time: "1 day ago" },
];

const SCHEMA_EVENTS = [
  { change: "New column mapped — risk_flag_v2", time: "2 hours ago" },
  { change: "Type coercion — amount → decimal(12,2)", time: "9 hours ago" },
  { change: "Deprecated field removed — legacy_ref", time: "2 days ago" },
];

const ACTIVITY = [
  {
    icon: RefreshCcw,
    color: "text-success",
    bg: "bg-success/10",
    title: "Model retrained successfully",
    detail: "XGBoost v2.4.1",
    time: "2 min ago",
  },
  {
    icon: FileStack,
    color: "text-secondary",
    bg: "bg-secondary/10",
    title: 'New dataset uploaded — "PaySim_May.csv"',
    detail: "1.2M records",
    time: "15 min ago",
  },
  {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    title: "Concept drift detected",
    detail: "Transactions · Location",
    time: "1 hour ago",
  },
  {
    icon: GitBranch,
    color: "text-secondary",
    bg: "bg-secondary/10",
    title: "Schema updated automatically",
    detail: "New column mapped",
    time: "2 hours ago",
  },
  {
    icon: ShieldAlert,
    color: "text-danger",
    bg: "bg-danger/10",
    title: "Fraud alert generated",
    detail: "Transaction ID · 824723",
    time: "3 hours ago",
  },
];

const STAT_CARDS = [
  {
    icon: DatabaseIcon,
    label: "Datasets Loaded",
    value: "4",
    delta: "+2 this week",
    bg: "bg-secondary/10",
    color: "text-secondary",
  },
  {
    icon: CreditCard,
    label: "Total Transactions",
    value: "40",
    delta: "+8.5% vs last week",
    bg: "bg-violet-500/10",
    color: "text-violet-400",
  },
  {
    icon: ShieldCheck,
    label: "Fraud Detected",
    value: "8",
    delta: "+12.4% vs last week",
    bg: "bg-danger/10",
    color: "text-danger",
  },
  {
    icon: TrendingUp,
    label: "Model Accuracy",
    value: "97.32%",
    delta: "+1.8% vs last week",
    bg: "bg-success/10",
    color: "text-success",
  },
];

function severityColor(sev: string) {
  if (sev === "High") return "text-danger bg-danger/10 border-danger/25";
  if (sev === "Medium") return "text-warning bg-warning/10 border-warning/25";
  return "text-success bg-success/10 border-success/25";
}

export function Dashboard({ onLogout }: DashboardProps) {
  return (
    <AppShell onLogout={onLogout}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-50">
          Welcome back, <span className="text-primary">Administrator</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Here's what's happening with your fraud detection system.
        </p>
      </motion.div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map(({ icon: Icon, label, value, delta, bg, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="rounded-2xl border border-card-border bg-card p-5"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
              <Icon size={19} />
            </div>
            <p className="mt-4 text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
              <ArrowUpRight size={13} />
              {delta}
            </p>
          </motion.div>
        ))}
      </div>

      {/* CHART ROW */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-card-border bg-card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Fraud Trend</h2>
            <span className="rounded-lg border border-card-border px-2.5 py-1 text-xs text-muted">
              Last 7 Days
            </span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND_DATA} margin={{ left: -20, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="fraudFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E293B" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#1E293B",
                    border: "1px solid #27344A",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="fraud"
                  stroke="#F97316"
                  strokeWidth={2.5}
                  fill="url(#fraudFill)"
                  dot={{ r: 3, fill: "#F97316", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-semibold text-slate-100">Prediction Distribution</h2>
          <div className="relative mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={PIE_DATA}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="none"
                >
                  {PIE_DATA.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold text-slate-50">1.24M</p>
              <p className="text-xs text-faint">Total</p>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {PIE_DATA.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-300">{d.name}</span>
                  <span className="text-faint">{d.value}%</span>
                </div>
                <span className="font-medium text-slate-200">{d.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DRIFT + SCHEMA ROW */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Recent Drift Events</h2>
            <button className="text-xs font-medium text-secondary hover:underline">View All</button>
          </div>
          <ul className="mt-4 space-y-3">
            {DRIFT_EVENTS.map((e) => (
              <li key={e.field} className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Activity size={15} className="text-secondary" />
                  <span className="text-sm text-slate-200">{e.field}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${severityColor(e.severity)}`}>
                    {e.severity}
                  </span>
                  <span className="text-xs text-faint">{e.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Recent Schema Changes</h2>
            <button className="text-xs font-medium text-secondary hover:underline">View All</button>
          </div>
          <ul className="mt-4 space-y-3">
            {SCHEMA_EVENTS.map((e) => (
              <li key={e.change} className="flex items-center justify-between rounded-xl border border-card-border/70 bg-bg/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <GitBranch size={15} className="text-primary" />
                  <span className="text-sm text-slate-200">{e.change}</span>
                </div>
                <span className="text-xs text-faint">{e.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ACTIVITY TIMELINE */}
      <div className="rounded-2xl border border-card-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Recent Activity</h2>
          <button className="text-xs font-medium text-secondary hover:underline">View All</button>
        </div>
        <ul className="mt-5 space-y-5">
          {ACTIVITY.map((a, i) => (
            <li key={a.title} className="relative flex gap-3.5 pl-0.5">
              {i !== ACTIVITY.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-4px)] w-px bg-card-border" />
              )}
              <div className={`z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full ${a.bg} ${a.color}`}>
                <a.icon size={15} />
              </div>
              <div className="flex flex-1 items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-100">{a.title}</p>
                  <p className="text-xs text-faint">{a.detail}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-faint">{a.time}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 pb-2 text-xs text-faint">
        <CheckCircle2 size={13} className="text-success" />
        All systems operational · Last sync 2 minutes ago
      </div>
    </AppShell>
  );
}
