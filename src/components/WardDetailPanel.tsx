import { DistrictData, Ward } from "@/data/syntheticData";
import { GovernanceScoreBadge } from "./GovernanceScoreBadge";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, IndianRupee, AlertTriangle, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface WardDetailPanelProps {
  district: DistrictData;
  onClose: () => void;
}

export function WardDetailPanel({ district, onClose }: WardDetailPanelProps) {
  const chartData = district.wards.map(w => ({
    name: w.name,
    score: w.governanceScore,
    risk: w.riskLevel,
  }));

  const barColor = (risk: string) =>
    risk === "green" ? "hsl(142 70% 45%)" : risk === "yellow" ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        className="glass-card rounded-lg overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{district.name} — Ward Breakdown</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chart */}
        <div className="p-4 border-b border-border">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Governance Scores by Ward</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(210 20% 92%)" }}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={barColor(entry.risk)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ward cards */}
        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {district.wards.map((w: Ward) => (
            <div key={w.id} className="bg-secondary/50 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">{w.name}</span>
                <GovernanceScoreBadge score={w.governanceScore} size="sm" />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3 w-3" /> {w.population.toLocaleString()}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IndianRupee className="h-3 w-3" /> ₹{w.fundAllocated.toLocaleString()}L
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> {w.complaintCount} complaints
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> {w.utilizationRate}% utilized
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
