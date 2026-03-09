export type IncomeCategory = "salario" | "extras" | "efectivo";

export type IncomeSubCategory =
  | "trabajo"
  | "bonus"
  | "paga_extra"
  | "reintegros"
  | "cash";

export type Income = {
  id: string;
  householdId: string;
  category: IncomeCategory;
  subCategory: IncomeSubCategory;
  description?: string;
  amount: number;
  date: string;
  createdByUid: string;
  createdByName: string;
 
};
