import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}

export default function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variants = {
    success: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800",
    warning: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 ring-1 ring-yellow-200 dark:ring-yellow-800",
    danger:  "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800",
    info:    "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800",
    neutral: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-1 ring-gray-200 dark:ring-slate-700",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: "paid" | "unpaid" | "partial" }) {
  const map: Record<string, { label: string; variant: "success" | "danger" | "warning" }> = {
    paid:    { label: "مدفوع",      variant: "success" },
    unpaid:  { label: "غير مدفوع", variant: "danger"  },
    partial: { label: "جزئي",      variant: "warning"  },
  };
  const { label, variant } = map[status] || { label: status, variant: "neutral" as const };
  return <Badge variant={variant}>{label}</Badge>;
}
