"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

/**
 * Cada item representa un mes del año
 */
export type ExpensesVsIncomesChartData = {
  month: string; // "Ene", "Feb", etc
  expenses: number; // total gastos del mes
  incomes: number; // total ingresos del mes
};

type Props = {
  data?: ExpensesVsIncomesChartData[];
};

export function ExpensesVsIncomesChart({ data = [] }: Props) {
  // Estado vacío (ej: usuario nuevo)
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No hay datos para mostrar
      </div>
    );
  }

  return (
    <ChartContainer
      config={{
        expenses: {
          label: "Gastos",
          color: "hsl(var(--destructive))",
        },
        incomes: {
          label: "Ingresos",
          color: "hsl(var(--success, 142 71% 45%))",
        },
      }}
      className="h-[300px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <ChartTooltip content={<ChartTooltipContent />} />

          {/* Gastos */}
          <Bar
            dataKey="expenses"
            stackId="total"
            fill="var(--color-expenses)"
            radius={[4, 4, 0, 0]}
          />

          {/* Ingresos */}
          <Bar
            dataKey="incomes"
            stackId="total"
            fill="var(--color-incomes)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
