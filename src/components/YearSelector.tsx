import { FISCAL_YEARS, FiscalYear } from "@/data/syntheticData";

interface YearSelectorProps {
  selected: FiscalYear;
  onChange: (year: FiscalYear) => void;
}

export function YearSelector({ selected, onChange }: YearSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
      {FISCAL_YEARS.map(year => (
        <button
          key={year}
          onClick={() => onChange(year)}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            selected === year
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {year}
        </button>
      ))}
    </div>
  );
}
