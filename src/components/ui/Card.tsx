import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
}

export default function Card({ children, className, title, actions }: CardProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors",
      className
    )}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
          {title && <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

const colorMap: Record<string, { bg: string; icon: string; text: string; sub: string; border: string }> = {
  amber:  { bg: "bg-amber-50  dark:bg-amber-950/20",  icon: "bg-amber-500  text-white", text: "text-amber-700  dark:text-amber-300",  sub: "text-amber-500  dark:text-amber-500",  border: "border-amber-100  dark:border-amber-900/40" },
  green:  { bg: "bg-emerald-50 dark:bg-emerald-950/20",icon: "bg-emerald-500 text-white", text: "text-emerald-700 dark:text-emerald-300", sub: "text-emerald-500 dark:text-emerald-500", border: "border-emerald-100 dark:border-emerald-900/40" },
  red:    { bg: "bg-red-50    dark:bg-red-950/20",    icon: "bg-red-500    text-white", text: "text-red-700    dark:text-red-300",    sub: "text-red-500    dark:text-red-500",    border: "border-red-100    dark:border-red-900/40" },
  blue:   { bg: "bg-blue-50   dark:bg-blue-950/20",   icon: "bg-blue-500   text-white", text: "text-blue-700   dark:text-blue-300",   sub: "text-blue-500   dark:text-blue-500",   border: "border-blue-100   dark:border-blue-900/40" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/20", icon: "bg-purple-500 text-white", text: "text-purple-700 dark:text-purple-300", sub: "text-purple-500 dark:text-purple-500", border: "border-purple-100 dark:border-purple-900/40" },
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
  icon: ReactNode;
  color?: "amber" | "green" | "red" | "blue" | "purple";
  sub?: string;
}) {
  const c = colorMap[color];
  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
      c.bg, c.border
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0", c.icon)}>
          {icon}
        </div>
      </div>
      <p className={cn("text-2xl font-bold tracking-tight", c.text)}>{value}</p>
      <p className={cn("text-xs font-medium mt-0.5", c.text, "opacity-80")}>{label}</p>
      {sub && <p className={cn("text-xs mt-1", c.sub, "opacity-70")}>{sub}</p>}
    </div>
  );
}
