export type ExpenseMainCategory =
  | "hogar"
  | "comida"
  | "transporte"
  | "servicios"
  | "salud"
  | "ocio"
  | "vacaciones";

export type ExpenseSubCategory =
  | "alquiler"
  | "hipoteca"
  | "supermercado"
  | "restaurante_bar"
  | "metro"
  | "tren"
  | "avion"
  | "coche"
  | "bici"
  | "luz"
  | "gas"
  | "agua"
  | "seguro"
  | "farmacia"
  | "medico"
  | "cine"
  | "eventos"
  | "deporte"
  | "vuelos"
  | "hotel"
  | "regalos"
  | "atracciones"
  | "comida"
  | "otros";

export interface Expense {
  id: string;
  householdId: string;

  createdByUid: string;
  createdByName: string;

  category: ExpenseMainCategory;
  subCategory: ExpenseSubCategory;

  description: string;
  amount: number;

  isFixed: boolean; // ✅ NUEVO (badge)
  date?: string; // ✅ YYYY-MM-DD
  createdAt: number;
}

export type MonthlyChartItem = {
  month: string;
  monthKey: string;
  expenses: number;
  incomes: number;
};