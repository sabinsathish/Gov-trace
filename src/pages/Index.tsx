import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  IndianRupee,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Users,
  BarChart3,
  MessageSquareWarning,
  Activity,
} from "lucide-react";
import {
  generateDistrictData,
  generateLedger,
  getOverviewStats,
  FiscalYear,
} from "@/data/syntheticData";
import { StatCard } from "@/components/StatCard";
import { DistrictTable } from "@/components/DistrictTable";
import { WardDetailPanel } from "@/components/WardDetailPanel";
import { BudgetTrendChart } from "@/components/BudgetTrendChart";
import { LedgerView } from "@/components/LedgerView";
import { RiskDistribution } from "@/components/RiskDistribution";
import { YearSelector } from "@/components/YearSelector";
import { DownloadProjectButton } from "@/components/DownloadProjectButton";
import type { DistrictData } from "@/data/syntheticData";

const Index = () => {
  const [selectedYear, setSelectedYear] = useState<FiscalYear>("2020-21");
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictData | null>(null);

  const districts = useMemo(() => generateDistrictData(selectedYear), [selectedYear]);
  const stats = useMemo(() => getOverviewStats(districts), [districts]);
  const ledger = useMemo(() => {
    const allWards = districts.flatMap((d) => d.wards);
    return generateLedger(allWards);
  }, [districts]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Glow effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "var(--gradient-glow)" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Gov<span className="text-primary">Trace</span>
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Ward-Level Governance Transparency — Karnataka State
              </p>
            </div>
            <div className="flex items-center gap-3">
              <YearSelector selected={selectedYear} onChange={setSelectedYear} />
              <DownloadProjectButton />
            </div>
          </div>
        </motion.header>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Allocated"
            value={`₹${(stats.totalAllocated / 100).toFixed(0)}Cr`}
            icon={IndianRupee}
            variant="primary"
            trend={`${Math.round((stats.totalUtilized / stats.totalAllocated) * 100)}% utilized`}
          />
          <StatCard
            label="Wards Tracked"
            value={stats.totalWards}
            icon={MapPin}
            variant="default"
            trend={`${districts.length} districts`}
          />
          <StatCard
            label="Avg Governance"
            value={stats.avgGov}
            icon={BarChart3}
            variant={stats.avgGov >= 70 ? "success" : "warning"}
          />
          <StatCard
            label="Grievances"
            value={stats.totalComplaints.toLocaleString()}
            icon={MessageSquareWarning}
            variant="warning"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <DistrictTable
              districts={districts}
              onSelectDistrict={setSelectedDistrict}
            />
          </div>
          <div className="space-y-6">
            <RiskDistribution
              green={stats.greenWards}
              yellow={stats.yellowWards}
              red={stats.redWards}
            />
            {selectedDistrict && (
              <WardDetailPanel
                district={selectedDistrict}
                onClose={() => setSelectedDistrict(null)}
              />
            )}
          </div>
        </div>

        {/* Charts & Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <BudgetTrendChart />
          <LedgerView entries={ledger} />
        </div>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            GovTrace Demo • Data sourced from Karnataka State Budget Allocation 2016-21 •
            Synthetic ward-level data generated for transparency simulation
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
