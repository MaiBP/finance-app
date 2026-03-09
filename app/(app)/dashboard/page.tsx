"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase.client";
import {
  ensureUserDoc,
  getUserDoc,
  getHouseholdDoc,
  subscribeToExpenses,
  subscribeToIncomes,
} from "@/lib/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);

  const currentYear = new Date().getFullYear().toString();

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

        setUserData(data);
        setHousehold(householdData);

        unsubExpenses?.();
        unsubIncomes?.();

        unsubExpenses = subscribeToExpenses(data.householdId, setExpenses);
        unsubIncomes = subscribeToIncomes(data.householdId, setIncomes);
      } catch (error) {
        console.error("Dashboard load error:", error);
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

  const userExpensesThisYear = useMemo(() => {
    if (!userData?.uid) return [];

    return expenses.filter(
      (e) => e.createdByUid === userData.uid && e.date?.slice(0, 4) === currentYear,
    );
  }, [expenses, userData?.uid, currentYear]);

  const userIncomesThisYear = useMemo(() => {
    if (!userData?.uid) return [];

    return incomes.filter(
      (i) => i.createdByUid === userData.uid && i.date?.slice(0, 4) === currentYear,
    );
  }, [incomes, userData?.uid, currentYear]);

  const chartData = useMemo(() => {
    return MONTHS.map((month) => {
      const expensesTotal = userExpensesThisYear
        .filter((e) => e.date?.slice(5, 7) === month.key)
        .reduce((sum, e) => sum + e.amount, 0);

      const incomesTotal = userIncomesThisYear
        .filter((i) => i.date?.slice(5, 7) === month.key)
        .reduce((sum, i) => sum + i.amount, 0);

      return {
        month: month.label,
        expenses: expensesTotal,
        incomes: incomesTotal,
      };
    });
  }, [userExpensesThisYear, userIncomesThisYear]);

  const totalExpenses = userExpensesThisYear.reduce((sum, e) => sum + e.amount, 0);
  const totalIncomes = userIncomesThisYear.reduce((sum, i) => sum + i.amount, 0);
  const balance = totalIncomes - totalExpenses;

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
      <h1 className="text-xl font-semibold">Resumen</h1>

      <p className="text-sm text-muted-foreground">
        Vista personal: este resumen muestra solo tus ingresos y gastos del año actual.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 lg:col-span-2">
          <h2 className="font-semibold mb-2">Gastos vs Ingresos ({currentYear})</h2>
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

        <div className="space-y-4">
          {household?.type === "group" && userData?.role === "owner" && (
            <Card className="p-4">
              <h2 className="font-semibold">Invitar miembros</h2>
              <p className="text-sm text-muted-foreground">
                Compartí este código para que otros se unan
              </p>

              <div className="mt-2 flex items-center gap-2">
                <code className="text-lg font-mono">{household.inviteCode}</code>
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(household.inviteCode)}
                >
                  Copiar
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Household</p>
            <p className="font-medium">{household?.name ?? "-"}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
