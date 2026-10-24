import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  color?: string;
  onClick?: () => void;
}

export function StatCard({ icon, label, value, color = "text-foreground", onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-card border border-border/50 rounded-xl p-4 flex items-center gap-3 transition-all duration-200 text-left w-full ${
        onClick
          ? "hover:border-primary/50 hover:bg-primary/5 cursor-pointer active:scale-[0.98]"
          : ""
      }`}
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      </div>
    </button>
  );
}
