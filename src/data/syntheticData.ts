// Seeded random for reproducibility
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

// Karnataka districts with approximate populations
const DISTRICTS = [
  { name: "Bengaluru Urban", population: 9621551, wards: 8 },
  { name: "Mysuru", population: 3001127, wards: 6 },
  { name: "Belagavi", population: 4779661, wards: 6 },
  { name: "Kalaburagi", population: 2564892, wards: 5 },
  { name: "Dakshina Kannada", population: 2089649, wards: 5 },
  { name: "Tumakuru", population: 2678980, wards: 5 },
  { name: "Ballari", population: 2532383, wards: 5 },
  { name: "Raichur", population: 1924773, wards: 4 },
  { name: "Dharwad", population: 1846993, wards: 4 },
  { name: "Shivamogga", population: 1752753, wards: 4 },
  { name: "Haveri", population: 1598506, wards: 4 },
  { name: "Chitradurga", population: 1660378, wards: 4 },
];

// Budget data from CSV (state-level schemes, in Lakhs)
export const BUDGET_SCHEMES = [
  { name: "Directorate of Agriculture", code: "2401_00_001_1_01", budgets: { "2016-17": 2486, "2017-18": 6011, "2018-19": 5507, "2019-20": 6217, "2020-21": 7302 } },
  { name: "Krishi Bhagya Yojane", code: "2401_00_102_0_27", budgets: { "2016-17": 20000, "2017-18": 60000, "2018-19": 50000, "2019-20": 25000, "2020-21": 4000 } },
  { name: "Supply of Seeds & Inputs", code: "2401_00_103_0_15", budgets: { "2016-17": 69780, "2017-18": 72359, "2018-19": 61530, "2019-20": 62823, "2020-21": 52103 } },
  { name: "Organic Farming", code: "2401_00_104_0_12", budgets: { "2016-17": 5657, "2017-18": 4000, "2018-19": 10000, "2019-20": 8700, "2020-21": 4850 } },
  { name: "Crop Insurance Scheme", code: "2401_00_110_0_07", budgets: { "2016-17": 67538, "2017-18": 84511, "2018-19": 84511, "2019-20": 84500, "2020-21": 90000 } },
  { name: "PM Kisan Samman Nidhi", code: "2401_00_800_0_05", budgets: { "2016-17": 0, "2017-18": 0, "2018-19": 0, "2019-20": 0, "2020-21": 260000 } },
  { name: "Farmer Support Schemes", code: "2401_00_102_0_28", budgets: { "2016-17": 10000, "2017-18": 7270, "2018-19": 10000, "2019-20": 24119, "2020-21": 1188 } },
  { name: "Agriculture Training & Extension", code: "2401_00_109_0_21", budgets: { "2016-17": 8712, "2017-18": 9870, "2018-19": 7264, "2019-20": 5402, "2020-21": 5433 } },
];

export const FISCAL_YEARS = ["2016-17", "2017-18", "2018-19", "2019-20", "2020-21"] as const;
export type FiscalYear = typeof FISCAL_YEARS[number];

export interface Ward {
  id: string;
  name: string;
  district: string;
  population: number;
  fundAllocated: number;
  fundUtilized: number;
  utilizationRate: number;
  complaintCount: number;
  resolutionRate: number;
  slaScore: number;
  governanceScore: number;
  riskLevel: "green" | "yellow" | "red";
  schemes: { name: string; allocated: number; utilized: number }[];
}

export interface DistrictData {
  name: string;
  population: number;
  totalAllocated: number;
  totalUtilized: number;
  wardCount: number;
  wards: Ward[];
  avgGovernanceScore: number;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  wardId: string;
  action: string;
  recordHash: string;
  previousHash: string;
  currentHash: string;
}

function generateHash(): string {
  const chars = "abcdef0123456789";
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(rand() * chars.length)];
  }
  return hash;
}

function generateWards(district: typeof DISTRICTS[0], year: FiscalYear): Ward[] {
  const wards: Ward[] = [];
  const totalBudgetForDistrict = BUDGET_SCHEMES.reduce((sum, s) => sum + (s.budgets[year] || 0), 0);
  const districtShare = totalBudgetForDistrict / DISTRICTS.length;
  
  // Generate ward populations with normal-ish distribution
  const avgPop = district.population / district.wards;
  const wardPops: number[] = [];
  let totalPop = 0;
  
  for (let i = 0; i < district.wards; i++) {
    const variation = 0.8 + rand() * 0.4; // ±20%
    const pop = Math.round(avgPop * variation);
    wardPops.push(pop);
    totalPop += pop;
  }

  for (let i = 0; i < district.wards; i++) {
    const popRatio = wardPops[i] / totalPop;
    const allocated = Math.round(districtShare * popRatio);
    
    // Utilization factor: 55-95%
    const utilFactor = 0.55 + rand() * 0.40;
    const utilized = Math.round(allocated * utilFactor);
    const utilizationRate = Math.round((utilized / allocated) * 100);
    
    // Complaints
    const complaintRatio = 0.01 + rand() * 0.04;
    const complaintCount = Math.round(wardPops[i] * complaintRatio);
    const resolutionRate = Math.round((0.5 + rand() * 0.45) * 100);
    
    // SLA
    const slaScore = Math.round((0.55 + rand() * 0.40) * 100);
    
    // Governance Score
    const governanceScore = Math.round(
      0.4 * utilizationRate + 0.3 * slaScore + 0.3 * resolutionRate
    );

    const riskLevel = governanceScore >= 80 ? "green" : governanceScore >= 60 ? "yellow" : "red";

    // Per-scheme allocation
    const schemes = BUDGET_SCHEMES.slice(0, 5).map(s => {
      const schemeAlloc = Math.round((s.budgets[year] || 0) / DISTRICTS.length * popRatio);
      const schemeUtil = Math.round(schemeAlloc * utilFactor * (0.9 + rand() * 0.2));
      return { name: s.name, allocated: schemeAlloc, utilized: Math.min(schemeUtil, schemeAlloc) };
    });

    wards.push({
      id: `${district.name.replace(/\s+/g, '-').toLowerCase()}-ward-${i + 1}`,
      name: `Ward ${i + 1}`,
      district: district.name,
      population: wardPops[i],
      fundAllocated: allocated,
      fundUtilized: utilized,
      utilizationRate,
      complaintCount,
      resolutionRate,
      slaScore,
      governanceScore,
      riskLevel,
      schemes,
    });
  }

  return wards;
}

export function generateDistrictData(year: FiscalYear): DistrictData[] {
  return DISTRICTS.map(d => {
    const wards = generateWards(d, year);
    const totalAllocated = wards.reduce((s, w) => s + w.fundAllocated, 0);
    const totalUtilized = wards.reduce((s, w) => s + w.fundUtilized, 0);
    const avgGov = Math.round(wards.reduce((s, w) => s + w.governanceScore, 0) / wards.length);
    return {
      name: d.name,
      population: d.population,
      totalAllocated,
      totalUtilized,
      wardCount: wards.length,
      wards,
      avgGovernanceScore: avgGov,
    };
  });
}

export function generateLedger(wards: Ward[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  let prevHash = "0".repeat(64);
  const actions = ["fund_allocated", "fund_disbursed", "utilization_updated", "audit_verified", "grievance_logged"];
  
  for (const ward of wards.slice(0, 20)) {
    const actionCount = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < actionCount; j++) {
      const recordHash = generateHash();
      const currentHash = generateHash();
      const day = Math.floor(rand() * 28) + 1;
      const month = Math.floor(rand() * 12) + 1;
      entries.push({
        id: `${entries.length + 1}`,
        timestamp: `2020-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(Math.floor(rand() * 24)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00Z`,
        wardId: ward.id,
        action: actions[Math.floor(rand() * actions.length)],
        recordHash,
        previousHash: prevHash,
        currentHash,
      });
      prevHash = currentHash;
    }
  }
  return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// Aggregate stats
export function getOverviewStats(districts: DistrictData[]) {
  const totalAllocated = districts.reduce((s, d) => s + d.totalAllocated, 0);
  const totalUtilized = districts.reduce((s, d) => s + d.totalUtilized, 0);
  const totalWards = districts.reduce((s, d) => s + d.wardCount, 0);
  const avgGov = Math.round(districts.reduce((s, d) => s + d.avgGovernanceScore, 0) / districts.length);
  const allWards = districts.flatMap(d => d.wards);
  const greenWards = allWards.filter(w => w.riskLevel === "green").length;
  const yellowWards = allWards.filter(w => w.riskLevel === "yellow").length;
  const redWards = allWards.filter(w => w.riskLevel === "red").length;
  const totalComplaints = allWards.reduce((s, w) => s + w.complaintCount, 0);
  
  return { totalAllocated, totalUtilized, totalWards, avgGov, greenWards, yellowWards, redWards, totalComplaints };
}
