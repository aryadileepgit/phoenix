import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { PhoenixLogo } from "../components/PhoenixLogo";

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const response = await login({
        email,
        password,
      });

      if (response.success) {
        /*
         * App.tsx handles persistence of the authentication state.
         */
        onLogin();

        navigate("/dashboard", { replace: true });
      } else {
        setError(response.message || "Invalid email or password.");
      }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: {
          status?: number;
          data?: {
            detail?: string;
            message?: string;
          };
        };
      };

      if (axiosError.response?.status === 401) {
        setError("Invalid email or password.");
      } else if (axiosError.response?.data?.detail) {
        setError(axiosError.response.data.detail);
      } else if (axiosError.response?.data?.message) {
        setError(axiosError.response.data.message);
      } else {
        setError("Unable to connect to the server.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg text-slate-100 lg:grid-cols-2">
      {/* LEFT — brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-12 py-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[420px] w-[420px] rounded-full bg-primary/15 blur-[130px]" />

        <div className="pointer-events-none absolute -top-24 right-0 h-[320px] w-[320px] rounded-full bg-secondary/15 blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex items-center gap-3"
        >
          <PhoenixLogo size={40} />

          <div>
            <p className="text-xl font-extrabold tracking-tight text-gradient-phoenix">
              PHOENIX
            </p>

            <p className="text-[11px] font-medium uppercase tracking-widest text-faint">
              Adaptive Fraud Detection Platform
            </p>
          </div>
        </motion.div>

        {/* Network illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative z-10 flex flex-1 items-center justify-center"
        >
          <svg viewBox="0 0 420 340" className="w-full max-w-md">
            <defs>
              <radialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
                <stop
                  offset="0%"
                  stopColor="#F97316"
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor="#F97316"
                  stopOpacity="0"
                />
              </radialGradient>

              <linearGradient
                id="node-line"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <stop offset="0%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
            </defs>

            <circle
              cx="210"
              cy="170"
              r="150"
              fill="url(#ring-glow)"
            />

            <circle
              cx="210"
              cy="170"
              r="118"
              fill="none"
              stroke="#1E293B"
              strokeWidth="1.5"
            />

            <circle
              cx="210"
              cy="170"
              r="82"
              fill="none"
              stroke="#1E293B"
              strokeWidth="1.5"
            />

            {[
              [210, 52],
              [330, 110],
              [340, 230],
              [230, 300],
              [100, 288],
              [70, 180],
              [110, 68],
              [210, 170],
            ].map(([x, y], i, arr) =>
              i < arr.length - 1 ? (
                <line
                  key={i}
                  x1={arr[arr.length - 1][0]}
                  y1={arr[arr.length - 1][1]}
                  x2={x}
                  y2={y}
                  stroke="url(#node-line)"
                  strokeWidth="1"
                  opacity="0.45"
                />
              ) : null
            )}

            {[
              [210, 52],
              [330, 110],
              [340, 230],
              [230, 300],
              [100, 288],
              [70, 180],
              [110, 68],
            ].map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={i === 2 ? 7 : 5}
                fill={i === 2 ? "#EF4444" : "#2563EB"}
              />
            ))}

            <circle
              cx="210"
              cy="170"
              r="26"
              fill="#0B1120"
              stroke="#F97316"
              strokeWidth="2"
            />

            <path
              d="M210 156 L216 168 L228 170 L218 179 L221 191 L210 184 L199 191 L202 179 L192 170 L204 168 Z"
              fill="#F97316"
            />
          </svg>
        </motion.div>

        <p className="relative z-10 text-xs text-faint">
          Enterprise-grade telemetry for real-time transaction risk scoring.
        </p>
      </div>

      {/* RIGHT — login card */}
      <div className="flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <PhoenixLogo size={36} />

            <p className="text-lg font-extrabold tracking-tight text-gradient-phoenix">
              PHOENIX
            </p>
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-10">
            <h1 className="text-2xl font-bold text-slate-50">
              Administrator Login
            </h1>

            <p className="mt-1.5 text-sm text-muted">
              Welcome back. Please sign in to continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold text-slate-300"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
                  />

                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@phoenix.ai"
                    className="w-full rounded-xl border border-card-border bg-bg/60 py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold text-slate-300"
                >
                  Password
                </label>

                <div className="relative">
                  <Lock
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
                  />

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-card-border bg-bg/60 py-3 pl-11 pr-11 text-sm text-slate-100 placeholder:text-faint outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/25"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint transition-colors hover:text-slate-300"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) =>
                      setRemember(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-card-border bg-bg accent-orange-500"
                  />

                  Remember me
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Login */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{
                  scale: submitting ? 1 : 1.02,
                }}
                whileTap={{
                  scale: submitting ? 1 : 0.98,
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(249,115,16,0.35)] transition-colors hover:bg-primary-dark disabled:opacity-70"
              >
                {submitting ? "Authenticating…" : "Login"}

                {!submitting && <ArrowRight size={16} />}
              </motion.button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-1.5 text-xs text-faint">
              <ShieldCheck size={13} />
              Secure Enterprise Authentication
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}