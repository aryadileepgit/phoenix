import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Network,
  Search,
  Loader2,
  Maximize2,
  Minimize2,
  Inbox,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { getNetwork } from "../services/networkService";
import { getAccountRisk } from "../services/accountsService";
import type {
  ConnectedAccount,
  NetworkResponse,
} from "../types/network";

/**
 * Graph node model built client-side from the backend
 * shared-attribute payload. Node/edge layout is visualization
 * only; every relationship comes from stored transactions.
 */
type EntityType = "account" | "card" | "device" | "email" | "address" | "data";

interface GraphEntity {
  id: string;
  type: EntityType;
  label: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  connections: number;
  relatedAccounts: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  strength: number;
}

const ENTITY_COLORS: Record<EntityType, string> = {
  account: "#3b82f6",
  device: "#f97316",
  card: "#22c55e",
  email: "#2563eb",
  address: "#facc15",
  data: "#94a3b8",
};

const ENTITY_GLYPHS: Record<EntityType, string> = {
  account: "◉",
  device: "▣",
  card: "▤",
  email: "@",
  address: "⌂",
  data: "⇄",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#facc15",
  HIGH: "#ef4444",
};

function mapEntityType(attrType: string, field: string): EntityType {
  if (attrType === "card") {
    return "card";
  }
  if (attrType === "device") {
    return "device";
  }
  const f = field.toLowerCase();
  if (f.includes("email") || f.includes("domain")) {
    return "email";
  }
  if (f.includes("addr")) {
    return "address";
  }
  if (f.startsWith("card")) {
    return "card";
  }
  if (f.toLowerCase().includes("device")) {
    return "device";
  }
  return "data";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function RiskBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-faint">—</span>;
  }
  const color = RISK_COLORS[level] ?? "#64748b";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}1A`,
        color: color,
      }}
    >
      {level}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return <span className="text-faint">—</span>;
  }
  const colors: Record<string, string> = {
    APPROVE: "#22c55e",
    VERIFY: "#facc15",
    BLOCK: "#ef4444",
  };
  const color = colors[decision] ?? "#64748b";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}1A`,
        color: color,
      }}
    >
      {decision}
    </span>
  );
}

function buildGraph(
  data: NetworkResponse,
  centerRisk: string | null
): { entities: GraphEntity[]; edges: GraphEdge[]; centerId: string } {
  const centerId = `account:${data.account_id}`;
  const entities: GraphEntity[] = [
    {
      id: centerId,
      type: "account",
      label: data.account_id,
      riskLevel:
        centerRisk === "HIGH" || centerRisk === "MEDIUM"
          ? centerRisk
          : "LOW",
      connections: data.connected_account_count,
      relatedAccounts: [],
    },
  ];
  const edges: GraphEdge[] = [];
  const attrIndex = new Map<string, GraphEntity>();

  const rank = (r: string) =>
    r === "HIGH" ? 3 : r === "MEDIUM" ? 2 : 1;

  for (const account of data.connected_accounts) {
    const accountNodeId = `account:${account.account_id}`;
    entities.push({
      id: accountNodeId,
      type: "account",
      label: account.account_id,
      riskLevel: account.network_risk,
      connections: account.shared_attributes.length,
      relatedAccounts: [],
    });

    for (const attr of account.shared_attributes) {
      const type = mapEntityType(attr.type, attr.field);
      const attrId = `attr:${attr.type}:${attr.field}:${attr.value}`;
      let node = attrIndex.get(attrId);
      if (!node) {
        node = {
          id: attrId,
          type,
          label: `${attr.field}=${attr.value}`,
          riskLevel: account.network_risk,
          connections: 0,
          relatedAccounts: [],
        };
        attrIndex.set(attrId, node);
        entities.push(node);
        edges.push({ source: centerId, target: attrId, strength: 1 });
      }
      if (!node.relatedAccounts.includes(account.account_id)) {
        node.relatedAccounts.push(account.account_id);
        node.connections = node.relatedAccounts.length;
      }
      if (rank(account.network_risk) > rank(node.riskLevel)) {
        node.riskLevel = account.network_risk;
      }
      edges.push({
        source: attrId,
        target: accountNodeId,
        strength: account.suspicious_transactions > 0 ? 1 : 0.5,
      });
    }
  }

  return { entities, edges: edges.slice(0, 400), centerId };
}

function NetworkCanvas({
  entities,
  edges,
  centerEntityId,
  selectedEntityId,
  width,
  height,
}: {
  entities: GraphEntity[];
  edges: GraphEdge[];
  centerEntityId: string;
  selectedEntityId: string | null;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    canvas.width = width;
    canvas.height = height;

    const nodes = entities.slice(0, 120).map((e) => ({
      ...e,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      vx: 0,
      vy: 0,
      radius: Math.max(20, Math.min(50, 20 + e.connections * 3)),
      fixed: false,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const centerNode = nodeMap.get(centerEntityId);
    if (centerNode) {
      centerNode.x = width / 2;
      centerNode.y = height / 2;
      centerNode.fixed = true;
    }

    let animationFrame = 0;

    const simulate = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.fixed && b.fixed) {
            continue;
          }
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (5000 / (dist * dist)) * 0.01;
          if (!a.fixed) {
            a.vx += (dx / dist) * force;
            a.vy += (dy / dist) * force;
          }
          if (!b.fixed) {
            b.vx -= (dx / dist) * force;
            b.vy -= (dy / dist) * force;
          }
        }
      }

      edges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return;
        }
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = ((dist * dist) / 10000) * edge.strength * 0.1;
        if (!source.fixed) {
          source.vx += (dx / dist) * force;
          source.vy += (dy / dist) * force;
        }
        if (!target.fixed) {
          target.vx -= (dx / dist) * force;
          target.vy -= (dy / dist) * force;
        }
      });

      nodes.forEach((node) => {
        if (node.fixed) {
          return;
        }
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        const margin = 50;
        node.x = Math.max(margin, Math.min(width - margin, node.x));
        node.y = Math.max(margin, Math.min(height - margin, node.y));
      });

      edges.forEach((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) {
          return;
        }
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = Math.max(1, edge.strength * 2);
        ctx.stroke();
      });

      nodes.forEach((node) => {
        const isSelected = node.id === selectedEntityId;
        const isCenter = node.id === centerEntityId;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle =
          ENTITY_COLORS[node.type] + (isSelected ? "CC" : "80");
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? "#f97316"
          : isCenter
            ? "#f97316"
            : "#334155";
        ctx.lineWidth = isSelected || isCenter ? 3 : 1;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.max(12, node.radius - 4)}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ENTITY_GLYPHS[node.type], node.x, node.y);
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "10px system-ui";
        ctx.fillText(
          node.label.slice(0, 12),
          node.x,
          node.y + node.radius + 12
        );
        const riskColor = RISK_COLORS[node.riskLevel] ?? "#64748b";
        ctx.beginPath();
        ctx.arc(
          node.x + node.radius - 6,
          node.y - node.radius + 6,
          6,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = riskColor;
        ctx.fill();
        ctx.strokeStyle = "#0b1120";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      animationFrame = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [entities, edges, centerEntityId, selectedEntityId, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%" }}
      className="rounded-xl border border-card-border bg-bg"
    />
  );
}

export function NetworkAnalysis({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAccount = searchParams.get("account") ?? "";

  const [accountId, setAccountId] = useState(initialAccount);
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [centerRisk, setCenterRisk] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const fetchNetwork = useCallback(async (target: string) => {
    const id = target.trim();
    if (!id) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [networkData, riskData] = await Promise.all([
        getNetwork(id),
        getAccountRisk(id).catch(() => null),
      ]);
      setData(networkData);
      setCenterRisk(riskData?.account_risk ?? null);
      setSelectedEntityId(`account:${networkData.account_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network lookup failed."
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialAccount) {
      fetchNetwork(initialAccount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graph = data
    ? buildGraph(data, centerRisk)
    : { entities: [], edges: [], centerId: "" };
  const selectedEntity = graph.entities.find(
    (e) => e.id === selectedEntityId
  );
  const flatTransactions = (data?.connected_accounts ?? []).flatMap(
    (a: ConnectedAccount) =>
      a.transactions.map((t) => ({
        ...t,
        accountId: a.account_id,
        shared: a.shared_attributes[0],
      }))
  ).sort(
    (a, b) =>
      (b.fraud_probability ?? -1) - (a.fraud_probability ?? -1)
  );

  return (
    <AppShell
      onLogout={onLogout}
      topbar={{
        title: "Network Analysis",
        description:
          "Shared card, device, and data attributes across scored accounts.",
        breadcrumb: "INVESTIGATION / Network Analysis",
        systemStatus: "online",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search Account ID..."
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchNetwork(accountId);
              }
            }}
            className="flex-1 rounded-lg border border-slate-600 bg-card px-4 py-2.5 text-sm text-slate-200 placeholder:text-faint focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => fetchNetwork(accountId)}
            disabled={isLoading || !accountId.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Search size={14} />
            )}
            {isLoading ? "Loading..." : "Analyze"}
          </button>
        </div>

        <div className="rounded-xl border border-card-border bg-card p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-300">
            How to read this graph
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>
              <span className="font-mono text-slate-300">
                Transaction ID
              </span>{" "}
              (e.g. SIM_*, PHX_*) — the dataset/ingest
              identifier of one scored row.
            </li>
            <li>
              <span className="font-mono text-slate-300">
                Account
              </span>{" "}
              — API-supplied grouping key from scored
              transactions (e.g. simulator ACC_* IDs).
              IEEE-CIS has no native customer/account ID, so
              this is a proxy, not a bank customer record.
            </li>
            <li>
              <span className="font-mono text-slate-300">
                Attribute
              </span>{" "}
              — an exact shared card/device/email/address
              value observed on stored rows (boolean flags
              excluded). Shared attributes are investigation
              signals, not proof of fraud.
            </li>
          </ul>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="h-96 animate-pulse rounded-xl border border-slate-600/50 bg-card" />
        )}

        {data && !isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-600/50 bg-card p-5">
                <p className="text-xs font-medium text-slate-400">
                  Network Status
                </p>
                <p className="mt-1 text-lg font-bold text-slate-50">
                  {data.network_status}
                </p>
              </div>
              <div className="rounded-xl border border-slate-600/50 bg-card p-5">
                <p className="text-xs font-medium text-slate-400">
                  Connected Accounts
                </p>
                <p className="mt-1 text-lg font-bold text-slate-50">
                  {data.connected_account_count}
                </p>
              </div>
              <div className="rounded-xl border border-slate-600/50 bg-card p-5">
                <p className="text-xs font-medium text-slate-400">
                  Target Account
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-primary">
                  {data.account_id}
                </p>
              </div>
            </div>

            {data.connected_account_count === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-600/50 bg-card p-12 text-center">
                <Inbox size={28} className="text-faint" />
                <p className="text-sm text-slate-400">
                  No shared attributes with other accounts.
                </p>
                <p className="text-xs text-faint">
                  This account shares no card, device, email, or
                  address values with any other scored account.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-card-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Entity Network
                    </h3>
                    <button
                      onClick={() => setShowFullscreen(!showFullscreen)}
                      className="rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-primary/50"
                    >
                      {showFullscreen ? (
                        <Minimize2 size={14} />
                      ) : (
                        <Maximize2 size={14} />
                      )}
                    </button>
                  </div>
                  <div
                    className={
                      showFullscreen
                        ? "fixed inset-0 z-50 h-[calc(100vh-4rem)] w-full p-4"
                        : "h-96"
                    }
                  >
                    <NetworkCanvas
                      entities={graph.entities}
                      edges={graph.edges}
                      centerEntityId={graph.centerId}
                      selectedEntityId={selectedEntityId}
                      width={showFullscreen ? 1200 : 800}
                      height={showFullscreen ? 700 : 384}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-card-border bg-card p-5 lg:col-span-2">
                    <h3 className="mb-4 text-sm font-semibold text-slate-100">
                      Shared Attributes
                    </h3>
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                      {graph.entities
                        .filter(
                          (e) =>
                            e.id !== graph.centerId &&
                            e.type !== "account"
                        )
                        .sort((a, b) => b.connections - a.connections)
                        .map((entity) => (
                          <button
                            key={entity.id}
                            onClick={() =>
                              setSelectedEntityId(entity.id)
                            }
                            className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                              selectedEntityId === entity.id
                                ? "border-primary bg-primary/5"
                                : "border-card-border/70 bg-bg/40 hover:border-primary/50"
                            }`}
                          >
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                              style={{
                                backgroundColor: `${ENTITY_COLORS[entity.type]}1A`,
                                color: ENTITY_COLORS[entity.type],
                              }}
                            >
                              {ENTITY_GLYPHS[entity.type]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-mono text-sm text-slate-100">
                                  {entity.label}
                                </span>
                                <span
                                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    borderColor: `${ENTITY_COLORS[entity.type]}40`,
                                    backgroundColor: `${ENTITY_COLORS[entity.type]}1A`,
                                    color: ENTITY_COLORS[entity.type],
                                  }}
                                >
                                  {entity.type.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[10px] text-faint">
                                {entity.connections} related account
                                {entity.connections === 1 ? "" : "s"}
                              </p>
                            </div>
                            <RiskBadge level={entity.riskLevel} />
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-card-border bg-card p-5">
                    <h3 className="mb-4 text-sm font-semibold text-slate-100">
                      Selected Entity
                    </h3>
                    {selectedEntity ? (
                      <div className="space-y-3">
                        <p className="break-all font-mono text-xs text-slate-200">
                          {selectedEntity.label}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-faint">Risk</span>
                          <RiskBadge
                            level={selectedEntity.riskLevel}
                          />
                        </div>
                        {selectedEntity.relatedAccounts.length > 0 && (
                          <div className="space-y-1.5 border-t border-card-border/40 pt-3">
                            <p className="text-[10px] font-semibold text-faint">
                              Related accounts
                            </p>
                            {selectedEntity.relatedAccounts.map(
                              (id) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() =>
                                    navigate(
                                      `/account-risk?account=${encodeURIComponent(id)}`
                                    )
                                  }
                                  className="block w-full truncate rounded-lg border border-card-border/70 bg-bg/40 px-3 py-1.5 text-left font-mono text-[11px] text-primary hover:border-primary/50"
                                >
                                  {id}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-48 items-center justify-center text-xs text-faint">
                        Select an entity
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-card-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Connected Transactions
                    </h3>
                    <span className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400">
                      {flatTransactions.length} transactions
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-card-border/70 bg-bg/40 text-[10px] uppercase tracking-wide text-faint">
                          <th className="px-3 py-2.5 font-medium">
                            Transaction ID
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Account
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Amount
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Shared Attribute
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Fraud Probability
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Risk
                          </th>
                          <th className="px-3 py-2.5 font-medium">
                            Decision
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {flatTransactions
                          .slice(0, 50)
                          .map((txn) => (
                            <tr
                              key={`${txn.accountId}-${txn.transaction_id}`}
                              className="border-b border-card-border/40 last:border-0 hover:bg-bg/40"
                            >
                              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                                {txn.transaction_id}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                                {txn.accountId}
                              </td>
                              <td className="px-3 py-2.5 text-slate-300">
                                {formatCurrency(txn.amount)}
                              </td>
                              <td className="max-w-[220px] truncate px-3 py-2.5 font-mono text-[11px] text-slate-400">
                                {txn.shared
                                  ? `${txn.shared.field}=${txn.shared.value}`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-slate-300">
                                {txn.fraud_probability !== null
                                  ? `${(txn.fraud_probability * 100).toFixed(2)}%`
                                  : "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <RiskBadge level={txn.risk_level} />
                              </td>
                              <td className="px-3 py-2.5">
                                <DecisionBadge
                                  decision={txn.decision}
                                />
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {!data && !isLoading && !error && (
          <div className="rounded-xl border border-slate-600/50 bg-card p-12 text-center">
            <Network size={48} className="mx-auto text-slate-600" />
            <p className="mt-4 text-sm text-slate-500">
              Enter an account ID to analyze its network connections
            </p>
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}

export default NetworkAnalysis;
