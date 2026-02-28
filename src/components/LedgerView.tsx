import { LedgerEntry } from "@/data/syntheticData";
import { motion } from "framer-motion";
import { Shield, Hash, Clock } from "lucide-react";

interface LedgerViewProps {
  entries: LedgerEntry[];
}

export function LedgerView({ entries }: LedgerViewProps) {
  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Hash-Chained Audit Ledger
        </h3>
      </div>
      <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
        {entries.slice(0, 15).map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="p-3 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground capitalize">
                {entry.action.replace(/_/g, " ")}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(entry.timestamp).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3 text-primary/60" />
              <span className="font-mono truncate max-w-[200px]">{entry.currentHash.slice(0, 24)}…</span>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">
              ward: {entry.wardId}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
