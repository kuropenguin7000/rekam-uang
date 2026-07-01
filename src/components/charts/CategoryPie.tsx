"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { CategorySlice } from "@/lib/aggregate";
import { useI18n } from "../I18nProvider";

export function CategoryPie({ data }: { data: CategorySlice[] }) {
  const { t } = useI18n();
  if (data.length === 0) {
    return (
      <div className="grid h-[280px] place-items-center text-sm text-muted">
        {t("chart.noSpending")}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((slice) => (
            <Cell key={slice.id} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            String(name),
          ]}
          contentStyle={tooltipStyle}
        />
        <Legend
          iconType="circle"
          formatter={(value) => (
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
} as const;
