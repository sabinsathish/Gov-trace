import { useState } from "react";
import { Download } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { generateDistrictData, generateLedger, BUDGET_SCHEMES, FISCAL_YEARS } from "@/data/syntheticData";

export function DownloadProjectButton() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const zip = new JSZip();

      // Generate all data
      const allData: Record<string, unknown> = {};
      for (const year of FISCAL_YEARS) {
        const districts = generateDistrictData(year);
        allData[year] = districts;
      }

      // Add datasets
      const dataFolder = zip.folder("datasets")!;
      
      // Original budget CSV
      dataFolder.file("budget_schemes.json", JSON.stringify(BUDGET_SCHEMES, null, 2));

      // Per-year synthetic ward data
      for (const year of FISCAL_YEARS) {
        const districts = generateDistrictData(year);
        dataFolder.file(`wards_${year}.json`, JSON.stringify(districts, null, 2));
        
        // CSV version
        const allWards = districts.flatMap(d => d.wards);
        const csvHeader = "ward_id,ward_name,district,population,fund_allocated,fund_utilized,utilization_rate,complaint_count,resolution_rate,sla_score,governance_score,risk_level\n";
        const csvRows = allWards.map(w =>
          `${w.id},${w.name},${w.district},${w.population},${w.fundAllocated},${w.fundUtilized},${w.utilizationRate},${w.complaintCount},${w.resolutionRate},${w.slaScore},${w.governanceScore},${w.riskLevel}`
        ).join("\n");
        dataFolder.file(`wards_${year}.csv`, csvHeader + csvRows);
      }

      // Ledger
      const districts2021 = generateDistrictData("2020-21");
      const allWards = districts2021.flatMap(d => d.wards);
      const ledger = generateLedger(allWards);
      dataFolder.file("audit_ledger.json", JSON.stringify(ledger, null, 2));

      // Grievance synthetic data
      const grievances = allWards.map(w => ({
        ward_id: w.id,
        district: w.district,
        complaint_count: w.complaintCount,
        resolution_rate: w.resolutionRate,
        population: w.population,
        complaint_ratio: (w.complaintCount / w.population).toFixed(4),
      }));
      dataFolder.file("grievance_stats.json", JSON.stringify(grievances, null, 2));
      dataFolder.file("grievance_stats.csv",
        "ward_id,district,complaint_count,resolution_rate,population,complaint_ratio\n" +
        grievances.map(g => `${g.ward_id},${g.district},${g.complaint_count},${g.resolution_rate},${g.population},${g.complaint_ratio}`).join("\n")
      );

      // README
      zip.file("README.md", `# GovTrace — Synthetic Dataset Package

## Contents

- \`datasets/budget_schemes.json\` — Original Karnataka budget allocation data (2016-21)
- \`datasets/wards_YYYY.json\` — Synthetic ward-level data per fiscal year
- \`datasets/wards_YYYY.csv\` — CSV versions of ward data
- \`datasets/audit_ledger.json\` — Hash-chained audit ledger entries
- \`datasets/grievance_stats.json/csv\` — Ward-level grievance statistics

## Methodology

Ward populations generated using normal distribution centered on district_population / ward_count (±20%).
Fund allocation uses proportional model: WardAllocation = DistrictFund × WardPopulation / DistrictPopulation.
Utilization factors range from 55-95%. Governance scores computed as weighted average of utilization (40%), SLA (30%), and complaint resolution (30%).

## Data Source

Karnataka State Budget Allocation for Major Schemes 2016-21.
`);

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "govtrace-datasets.zip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {loading ? "Generating…" : "Download ZIP"}
    </button>
  );
}
