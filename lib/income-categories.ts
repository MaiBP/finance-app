import { IncomeCategory, IncomeSubCategory } from "@/types/income";

export const INCOME_CATEGORIES: Record<
  IncomeCategory,
  { label: string; sub: { value: IncomeSubCategory; label: string }[] }
> = {
  salario: {
    label: "Salario",
    sub: [{ value: "trabajo", label: "Trabajo" }],
  },
  extras: {
    label: "Extras",
    sub: [
      { value: "bonus", label: "Bonus" },
      { value: "paga_extra", label: "Paga extra" },
      { value: "reintegros", label: "Reintegros" },
    ],
  },
  efectivo: {
    label: "Efectivo",
    sub: [{ value: "cash", label: "Cash" }],
  },
};
