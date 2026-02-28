# GovTrace — Ward-Level Governance Transparency Dashboard

A standalone React dashboard visualizing ward-level budget, governance scores, grievances, and risk levels across Karnataka districts (2016–2021).

---

## Prerequisites

- **Node.js** v18 or higher → https://nodejs.org
- **npm** (comes with Node.js)

Check your versions:
```bash
node -v   # should be v18+
npm -v
```

---

## How to Run Locally

### 1. Install dependencies
```bash
npm install
```

### 2. Start the development server
```bash
npm run dev
```

### 3. Open in browser
Visit **http://localhost:8080**

---

## Other Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server with hot reload |
| `npm run build` | Build for production (outputs to `/dist`) |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run unit tests |

---

## Project Structure

```
src/
├── data/
│   ├── syntheticData.ts      # All data generation logic
│   └── karnataka_budget.csv  # Real Karnataka budget source data
├── components/
│   ├── BudgetTrendChart.tsx  # Recharts line chart for budget trends
│   ├── DistrictTable.tsx     # Clickable table of all districts
│   ├── WardDetailPanel.tsx   # Side panel showing ward details
│   ├── LedgerView.tsx        # Audit ledger entries
│   ├── RiskDistribution.tsx  # Green/Yellow/Red ward risk pie chart
│   ├── StatCard.tsx          # Summary stat cards at the top
│   ├── YearSelector.tsx      # Fiscal year dropdown (2016–2021)
│   └── DownloadProjectButton.tsx
├── pages/
│   └── Index.tsx             # Main dashboard page
└── main.tsx                  # App entry point
```

---

## Notes

- All data is **synthetically generated** — no backend or API keys required.
- The "Download ZIP" button in the UI exports all ward data as JSON/CSV.
- Changing the fiscal year re-generates all district and ward data.
