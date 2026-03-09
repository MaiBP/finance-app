"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase.client";
import {
  ensureUserDoc,
  getHouseholdDoc,
  getUserDoc,
  subscribeToExpenses,
  subscribeToIncomes,
} from "@/lib/firestore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ExpensesVsIncomesChart } from "@/components/charts/ExpensesVsIncomesChart";

import type { UserData } from "@/types/user";
import type { Household } from "@/types/household";
import type { Expense } from "@/types/expense";
import type { Income } from "@/types/income";

const MONTHS = [
  { key: "01", label: "Ene" },
  { key: "02", label: "Feb" },
  { key: "03", label: "Mar" },
  { key: "04", label: "Abr" },
  { key: "05", label: "May" },
  { key: "06", label: "Jun" },
  { key: "07", label: "Jul" },
  { key: "08", label: "Ago" },
  { key: "09", label: "Sep" },
  { key: "10", label: "Oct" },
  { key: "11", label: "Nov" },
  { key: "12", label: "Dic" },
] as const;

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, string>>({});

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    let unsubExpenses: (() => void) | null = null;
    let unsubIncomes: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          window.location.href = "/login";
          return;
        }

        await ensureUserDoc({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? user.email ?? "User",
        });

        const data = (await getUserDoc(user.uid)) as UserData | null;

        if (!data?.householdId) {
          window.location.href = "/setup";
          return;
        }

        const householdData = (await getHouseholdDoc(
          data.householdId,
        )) as Household | null;

        setHousehold(householdData);

        unsubExpenses?.();
        unsubIncomes?.();

        unsubExpenses = subscribeToExpenses(data.householdId, setExpenses);
        unsubIncomes = subscribeToIncomes(data.householdId, setIncomes);
      } catch (error) {
        console.error("Analytics load error:", error);
        alert("Error cargando datos. Revisá permisos.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubExpenses?.();
      unsubIncomes?.();
    };
  }, []);

  useEffect(() => {
    const loadMemberProfiles = async () => {
      if (!household?.memberUids?.length) {
        setMemberProfiles({});
        return;
      }

      const entries = await Promise.all(
        household.memberUids.map(async (uid) => {
          const member = (await getUserDoc(uid)) as UserData | null;
          return [uid, member?.displayName || member?.email || uid] as const;
        }),
      );

      setMemberProfiles(Object.fromEntries(entries));
    };

    void loadMemberProfiles();
  }, [household?.memberUids]);

  const resolveMemberName = (uid: string, fallbackName?: string) =>
    memberProfiles[uid] || fallbackName || uid;

  const yearsOptions = useMemo(() => {
    const years = new Set<string>();

    expenses.forEach((e) => {
      if (e.date) years.add(e.date.slice(0, 4));
    });

    incomes.forEach((i) => {
      if (i.date) years.add(i.date.slice(0, 4));
    });

    if (years.size === 0) years.add(currentYear);

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [expenses, incomes, currentYear]);

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => e.date?.slice(0, 4) === year),
    [expenses, year],
  );

  const filteredIncomes = useMemo(
    () => incomes.filter((i) => i.date?.slice(0, 4) === year),
    [incomes, year],
  );

  const chartData = useMemo(() => {
    return MONTHS.map((month) => {
      const expensesTotal = filteredExpenses
        .filter((e) => e.date?.slice(5, 7) === month.key)
        .reduce((sum, e) => sum + e.amount, 0);

      const incomesTotal = filteredIncomes
        .filter((i) => i.date?.slice(5, 7) === month.key)
        .reduce((sum, i) => sum + i.amount, 0);

      return {
        month: month.label,
        expenses: expensesTotal,
        incomes: incomesTotal,
      };
    });
  }, [filteredExpenses, filteredIncomes]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncomes = filteredIncomes.reduce((sum, i) => sum + i.amount, 0);
  const balance = totalIncomes - totalExpenses;

  const unifiedExpensesHistory = useMemo(() => {
    return [...expenses].sort((a, b) => {
      const aDate = a.date ?? "";
      const bDate = b.date ?? "";
      if (aDate !== bDate) return aDate < bDate ? 1 : -1;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [expenses]);

  const unifiedIncomesHistory = useMemo(() => {
    return [...incomes].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    });
  }, [incomes]);

  const maxExpenseMonth = chartData.reduce(
    (acc, curr) => (curr.expenses > acc.expenses ? curr : acc),
    chartData[0] ?? { month: "-", expenses: 0, incomes: 0 },
  );

  const maxIncomeMonth = chartData.reduce(
    (acc, curr) => (curr.incomes > acc.incomes ? curr : acc),
    chartData[0] ?? { month: "-", expenses: 0, incomes: 0 },
  );

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Análisis Global</h1>

      <p className="text-sm text-muted-foreground">
        Esta vista consolida ingresos y gastos de todos los miembros del household.
      </p>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Gastos vs Ingresos ({year})</h2>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {yearsOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ExpensesVsIncomesChart data={chartData} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Ingresos acumulados</p>
            <p className="font-semibold text-success">+€{totalIncomes.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Gastos acumulados</p>
            <p className="font-semibold text-destructive">-€{totalExpenses.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Balance acumulado</p>
            <p
              className={`font-semibold ${
                balance >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {balance >= 0 ? "+" : "-"}€{Math.abs(balance).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-3 text-sm text-muted-foreground">
          Mes con más gasto: {maxExpenseMonth.month} (-€{maxExpenseMonth.expenses.toFixed(2)}) ·
          Mes con más ingreso: {maxIncomeMonth.month} (+€{maxIncomeMonth.incomes.toFixed(2)})
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Household</p>
        <p className="font-medium">{household?.name ?? "-"}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Miembros: {household?.memberUids?.length ?? 0}
        </p>
        {(household?.memberUids?.length ?? 0) > 0 && (
          <p className="text-sm mt-1">
            {(household?.memberUids ?? [])
              .map((uid) => resolveMemberName(uid))
              .join(", ")}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Historial de gastos (unificado)</h2>

        <div className="space-y-2">
          {unifiedExpensesHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay gastos cargados.
            </p>
          )}

          {unifiedExpensesHistory.map((item) => (
            <div key={item.id} className="flex justify-between border-b py-2">
              <div>
                <p className="font-medium">{item.description || item.subCategory}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category} · {item.subCategory} · {item.date} ·{" "}
                  {resolveMemberName(item.createdByUid, item.createdByName)}
                </p>
              </div>

              <div className="text-right">
                <Badge className="mb-1 bg-destructive/15 text-destructive">
                  Gasto
                </Badge>
                <p className="text-destructive">-€{item.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Historial de ingresos (unificado)</h2>

        <div className="space-y-2">
          {unifiedIncomesHistory.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay ingresos cargados.
            </p>
          )}

          {unifiedIncomesHistory.map((item) => (
            <div key={item.id} className="flex justify-between border-b py-2">
              <div>
                <p className="font-medium">{item.description || item.subCategory}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category} · {item.subCategory} · {item.date} ·{" "}
                  {resolveMemberName(item.createdByUid, item.createdByName)}
                </p>
              </div>

              <div className="text-right">
                <Badge className="mb-1 bg-success/15 text-success">
                  Ingreso
                </Badge>
                <p className="text-success">+€{item.amount.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
