interface GovernanceScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function GovernanceScoreBadge({ score, size = "md" }: GovernanceScoreBadgeProps) {
  const riskLevel = score >= 80 ? "green" : score >= 60 ? "yellow" : "red";

  const colorMap = {
    green: "bg-success/15 text-success border-success/30",
    yellow: "bg-warning/15 text-warning border-warning/30",
    red: "bg-destructive/15 text-destructive border-destructive/30",
  };

  const sizeMap = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5 font-bold",
  };

  return (
    <span className={`inline-flex items-center rounded-full border font-mono font-semibold ${colorMap[riskLevel]} ${sizeMap[size]}`}>
      {score}
    </span>
  );
}
