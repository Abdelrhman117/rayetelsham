import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}

export default function Badge({ children, variant = "neutral", className }: BadgeProps) {
  const variants = {
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
    neutral: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: "paid" | "unpaid" | "partial" }) {
  const map: Record<string, { label: string; variant: "success" | "danger" | "warning" }> = {
    paid: { label: "مدفوع", variant: "success" },
    unpaid: { label: "غير مدفوع", variant: "danger" },
    partial: { label: "جزئي", variant: "warning" },
  };
  const { label, variant } = map[status] || { label: status, variant: "neutral" as const };
  return <Badge variant={variant}>{label}</Badge>;
}
