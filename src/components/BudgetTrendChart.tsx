import { BUDGET_SCHEMES, FISCAL_YEARS } from "@/data/syntheticData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CHART_COLORS = [
  "hsl(173 80% 40%)",
  "hsl(38 92% 50%)",
  "hsl(142 70% 45%)",
  "hsl(262 60% 55%)",
  "hsl(0 72% 51%)",
];

export function BudgetTrendChart() {
  const topSchemes = BUDGET_SCHEMES.slice(0, 5);
  
  const data = FISCAL_YEARS.map(year => {
    const point: Record<string, string | number> = { year };
    topSchemes.forEach(s => {
      point[s.name] = s.budgets[year];
    });
    return point;
  });

  return (
    <div className="glass-card rounded-lg p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Budget Trends (₹ Lakhs) — Top 5 Schemes</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <XAxis dataKey="year" tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(215 15% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "hsl(210 20% 92%)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "hsl(215 15% 50%)" }} />
          {topSchemes.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={CHART_COLORS[i]}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS[i] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
