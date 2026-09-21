import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, DatabaseZap, TrendingUp, BrainCircuit, ArrowRight, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { PhoenixLogo } from "../components/PhoenixLogo";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "AI Powered Fraud Detection",
    desc: "Detect fraudulent transactions in real time using ensemble models.",
  },
  {
    icon: DatabaseZap,
    title: "Automated Schema Evolution",
    desc: "Automatically adapt to new fields and changing data schemas.",
  },
  {
    icon: TrendingUp,
    title: "Concept Drift Detection",
    desc: "Monitor distribution shifts and flag degrading model accuracy.",
  },
  {
    icon: BrainCircuit,
    title: "Continuous Learning",
    desc: "Self-improving pipelines that retrain as fraud patterns evolve.",
  },
];

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-bg text-slate-100">
      {/* background layers */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-secondary/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <PhoenixLogo size={92} glow className="mx-auto" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mt-8 text-6xl font-extrabold tracking-tight text-gradient-phoenix sm:text-7xl"
        >
          PHOENIX
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          className="mt-3 text-lg font-medium tracking-wide text-slate-300 sm:text-xl"
        >
          Adaptive Fraud Transaction Detection Platform
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
          className="mt-10 grid w-full grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group rounded-2xl border border-card-border bg-card/60 p-5 text-left backdrop-blur-sm transition-colors hover:border-primary/50"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Icon size={20} strokeWidth={2} />
              </div>
              <p className="text-sm font-semibold text-slate-100">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-faint">{desc}</p>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 max-w-2xl text-sm leading-relaxed text-muted"
        >
          Phoenix is an intelligent adaptive fraud detection platform capable of identifying
          fraudulent financial transactions while automatically adapting to evolving fraud
          patterns and changing data schemas.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/login")}
          className="mt-10 flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-[0_8px_30px_rgba(249,115,22,0.35)] transition-colors hover:bg-primary-dark"
        >
          Get Started
          <ArrowRight size={18} />
        </motion.button>

        <p className="mt-16 text-xs text-faint">© 2026 Phoenix. All rights reserved.</p>
      </main>
    </div>
  );
}

export default Welcome;
