import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

export default function Card({ children, className, title, actions }: CardProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/60 transition-colors",
      className
    )}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700/60">
          {title && <h2 className="font-semibold text-gray-800 dark:text-slate-100 text-base">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

const gradients: Record<string, string> = {
  amber:  "from-amber-500  to-amber-600",
  green:  "from-emerald-500 to-green-600",
  red:    "from-red-500    to-rose-600",
  blue:   "from-blue-500   to-indigo-600",
  purple: "from-purple-500 to-violet-600",
};

const lightBg: Record<string, string> = {
  amber:  "bg-amber-50  dark:bg-amber-950/30  border-amber-100  dark:border-amber-900/40",
  green:  "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40",
  red:    "bg-red-50    dark:bg-red-950/30    border-red-100    dark:border-red-900/40",
  blue:   "bg-blue-50   dark:bg-blue-950/30   border-blue-100   dark:border-blue-900/40",
  purple: "bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900/40",
};

const textColor: Record<string, string> = {
  amber:  "text-amber-700  dark:text-amber-300",
  green:  "text-emerald-700 dark:text-emerald-300",
  red:    "text-red-700    dark:text-red-300",
  blue:   "text-blue-700   dark:text-blue-300",
  purple: "text-purple-700 dark:text-purple-300",
};

export function StatCard({
  label,
  value,
  icon,
  color = "amber",
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: "amber" | "green" | "red" | "blue" | "purple";
  sub?: string;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      lightBg[color]
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br shrink-0",
          gradients[color]
        )}>
          <span className="text-lg">{icon}</span>
        </div>
      </div>
      <p className={cn("text-2xl font-bold tracking-tight", textColor[color])}>{value}</p>
      <p className={cn("text-xs font-medium mt-1 opacity-80", textColor[color])}>{label}</p>
      {sub && <p className={cn("text-xs mt-1 opacity-50", textColor[color])}>{sub}</p>}
    </div>
  );
}
