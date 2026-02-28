import { DistrictData } from "@/data/syntheticData";
import { GovernanceScoreBadge } from "./GovernanceScoreBadge";
import { motion } from "framer-motion";

interface DistrictTableProps {
  districts: DistrictData[];
  onSelectDistrict: (district: DistrictData) => void;
}

export function DistrictTable({ districts, onSelectDistrict }: DistrictTableProps) {
  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">District Overview</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
              <th className="text-left p-3 font-medium">District</th>
              <th className="text-right p-3 font-medium">Wards</th>
              <th className="text-right p-3 font-medium">Allocated (₹L)</th>
              <th className="text-right p-3 font-medium">Utilized (₹L)</th>
              <th className="text-right p-3 font-medium">Util %</th>
              <th className="text-center p-3 font-medium">Gov Score</th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d, i) => (
              <motion.tr
                key={d.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onSelectDistrict(d)}
                className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
              >
                <td className="p-3 font-medium text-foreground">{d.name}</td>
                <td className="p-3 text-right font-mono text-muted-foreground">{d.wardCount}</td>
                <td className="p-3 text-right font-mono text-foreground">{d.totalAllocated.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-foreground">{d.totalUtilized.toLocaleString()}</td>
                <td className="p-3 text-right font-mono text-foreground">
                  {Math.round((d.totalUtilized / d.totalAllocated) * 100)}%
                </td>
                <td className="p-3 text-center">
                  <GovernanceScoreBadge score={d.avgGovernanceScore} size="sm" />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
