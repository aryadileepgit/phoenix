/**
 * Mirrors backend/app/api/routes/dashboard.py.
 * Every number is a stored-row aggregate; absent subsystems
 * are null (rendered as "—"), never zero-filled fiction.
 */

export interface DashboardKpis {
  totalTransactions: number;
  fraudDetected: number;
  highRiskTransactions: number;
  verificationRequired: number;
}

export interface DashboardModel {
  name: string;
  accuracy: number;
  roc_auc: number;
}

export interface DashboardDrift {
  status: "stable" | "drift" | "never_run";
  severity: string | null;
  last_check: string | null;
}

export interface RecentTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  transaction_time: string;
  fraud_probability: number | null;
  risk_level: string | null;
  decision: string | null;
}

export interface FraudActivityPoint {
  date: string | null;
  fraud: number;
  highRisk: number;
  blocked: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  model: DashboardModel | null;
  drift: DashboardDrift;
  riskDistribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
  decisionDistribution: {
    APPROVE: number;
    VERIFY: number;
    BLOCK: number;
  };
  recentTransactions: RecentTransaction[];
  fraudActivity: FraudActivityPoint[];
  system: {
    schemaPendingMappings: number;
    lastRetraining: string | null;
    retrainingActive: boolean;
  };
}
