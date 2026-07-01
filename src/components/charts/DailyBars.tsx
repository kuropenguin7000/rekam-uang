"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatCurrency } from "@/lib/format";
import type { DayPoint } from "@/lib/aggregate";
import { useI18n } from "../I18nProvider";

interface Props {
  data: DayPoint[];
  /** per-day budget threshold; bars over it turn red (PRD visual anchors) */
  dailyBudget: number;
}

export function DailyBars({ data, dailyBudget }: Props) {
  const { t } = useI18n();
  if (data.length === 0) {
    return (
      <div className="grid h-[280px] place-items-center text-sm text-muted">
        {t("chart.noSpending")}
      </div>
    );
  }

  // thin the x-axis labels when the range is long
  const interval = data.length > 14 ? Math.ceil(data.length / 10) : 0;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          interval={interval}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(v)}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-muted)" }}
          formatter={(value) => [formatCurrency(Number(value)), t("chart.spent")]}
          contentStyle={tooltipStyle}
        />
        {dailyBudget > 0 && (
          <ReferenceLine
            y={dailyBudget}
            stroke="var(--warning)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            label={<BudgetLabel text={t("dash.dailyBudgetName")} />}
          />
        )}
        <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={42}>
          {data.map((d) => (
            <Cell
              key={d.date}
              fill={
                dailyBudget > 0 && d.amount > dailyBudget
                  ? "var(--danger)"
                  : "var(--success)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A readable daily-budget pill anchored to the left of the budget line. */
function BudgetLabel(props: {
  text?: string;
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
}) {
  const vb = props.viewBox;
  if (!vb || vb.x == null || vb.y == null) return null;
  const text = props.text ?? "";
  // width scales with text length so longer translations (e.g. Arabic) fit
  const w = Math.max(64, text.length * 8 + 16);
  const h = 17;
  const x = vb.x + 6;
  // place above the line, but flip below it if too close to the top
  const above = vb.y > h + 6;
  const y = above ? vb.y - h - 3 : vb.y + 4;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        fill="var(--warning)"
      />
      <text
        x={x + w / 2}
        y={y + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        fill="#ffffff"
      >
        {text}
      </text>
    </g>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
} as const;
