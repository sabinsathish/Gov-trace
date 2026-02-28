import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface RiskDistributionProps {
  green: number;
  yellow: number;
  red: number;
}

export function RiskDistribution({ green, yellow, red }: RiskDistributionProps) {
  const data = [
    { name: "Green (80–100)", value: green },
    { name: "Yellow (60–79)", value: yellow },
    { name: "Red (<60)", value: red },
  ];

  const COLORS = ["hsl(142 70% 45%)", "hsl(38 92% 50%)", "hsl(0 72% 51%)"];

  return (
    <div className="glass-card rounded-lg p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Ward Risk Distribution</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "hsl(220 18% 10%)", border: "1px solid hsl(220 15% 18%)", borderRadius: 8, fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
            {d.value} {d.name.split(" ")[0]}
          </div>
        ))}
      </div>
    </div>
  );
}
