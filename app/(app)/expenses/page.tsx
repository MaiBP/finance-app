"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase.client";
import {
  addExpense,
  updateExpense,
  deleteExpense,
  subscribeToExpenses,
  getUserDoc,
} from "@/lib/firestore";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { Pencil, Trash2, Search } from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";

import type {
  Expense,
  ExpenseMainCategory,
  ExpenseSubCategory,
} from "@/types/expense";
import type { UserData } from "@/types/user";

const PAGE_SIZE = 10;
const MONTH_OPTIONS = [
  { value: "01", label: "Ene" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Abr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Ago" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dic" },
] as const;

export default function ExpensesPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseMainCategory>("hogar");
  const [subCategory, setSubCategory] =
    useState<ExpenseSubCategory>("alquiler");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isFixed, setIsFixed] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSubCategory, setFilterSubCategory] = useState("all");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [filterYear, setFilterYear] = useState("all");
  const [onlyFixed, setOnlyFixed] = useState(false);
  const [page, setPage] = useState(1);

  const currentYear = new Date().getFullYear().toString();
  const userId = user?.uid ?? null;

  // auth + data
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        window.location.href = "/login";
        return;
      }

      const userData = (await getUserDoc(u.uid)) as UserData;
      if (!userData?.householdId) {
        window.location.href = "/setup";
        return;
      }

      setUser(userData);
      setHouseholdId(userData.householdId);

      const unsubExpenses = subscribeToExpenses(
        userData.householdId,
        setExpenses,
      );

      setLoading(false);
      return () => unsubExpenses();
    });

    return () => unsub();
  }, []);

  // editar
  const startEdit = (e: Expense) => {
    setEditingExpense(e);
    setDate(e.date ?? new Date().toISOString().slice(0, 10));
    setCategory(e.category);
    setSubCategory(e.subCategory);
    setDescription(e.description ?? "");
    setAmount(String(e.amount));
    setIsFixed(e.isFixed);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setDate(new Date().toISOString().slice(0, 10));
    setCategory("hogar");
    setSubCategory("alquiler");
    setDescription("");
    setAmount("");
    setIsFixed(false);
  };

  const handleSubmit = async () => {
    if (!householdId || !amount) return;

    if (editingExpense) {
      await updateExpense({
        householdId,
        expenseId: editingExpense.id,
        data: {
          date,
          category,
          subCategory,
          description,
          amount: Number(amount),
          isFixed,
        },
      });
    } else {
      await addExpense({
        householdId,
        date,
        user: {
          uid: user!.uid,
          displayName: user!.displayName,
        },
        category,
        subCategory,
        description,
        amount: Number(amount),
        isFixed,
      });
    }

    resetForm();
  };

  // filtros historial
  const toggleMonth = (month: string) => {
    setSelectedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month],
    );
  };

  const monthFilterLabel =
    selectedMonths.length === 0
      ? "Meses"
      : selectedMonths.length <= 2
        ? MONTH_OPTIONS.filter((m) => selectedMonths.includes(m.value))
            .map((m) => m.label)
            .join(", ")
        : `${selectedMonths.length} meses`;

  const personalExpenses = useMemo(() => {
    if (!userId) return [];
    return expenses.filter((e) => e.createdByUid === userId);
  }, [expenses, userId]);

  const filteredExpenses = useMemo(() => {
    return personalExpenses.filter((e) => {
      if (onlyFixed && !e.isFixed) return false;
      if (filterCategory !== "all" && e.category !== filterCategory)
        return false;
      if (filterSubCategory !== "all" && e.subCategory !== filterSubCategory)
        return false;
      if (
        selectedMonths.length > 0 &&
        (!e.date || !selectedMonths.includes(e.date.slice(5, 7)))
      )
        return false;
      if (filterYear !== "all" && e.date?.slice(0, 4) !== filterYear)
        return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !e.description?.toLowerCase().includes(q) &&
          !e.category.includes(q) &&
          !e.subCategory.includes(q) &&
          !e.date?.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    personalExpenses,
    search,
    filterCategory,
    filterSubCategory,
    selectedMonths,
    filterYear,
    onlyFixed,
  ]);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredExpenses.length / PAGE_SIZE),
  );

  const paginatedExpenses = filteredExpenses.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const yearsOptions = useMemo(() => {
    const years = new Set<string>();
    personalExpenses.forEach((e) => {
      if (e.date) years.add(e.date.slice(0, 4));
    });

    // fallback: show current year at least
    if (years.size === 0) years.add(currentYear);

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [personalExpenses, currentYear]);

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Gastos</h1>

      {/* AGREGAR GASTO */}
      <Card className="mx-auto max-w-5xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label>Fecha</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Categoría</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as ExpenseMainCategory);
                setSubCategory(
                  EXPENSE_CATEGORIES[v as ExpenseMainCategory].sub[0].value,
                );
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select
              value={subCategory}
              onValueChange={(v) => setSubCategory(v as ExpenseSubCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES[category].sub.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descripción</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label>Importe</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={isFixed}
              onCheckedChange={(v) => setIsFixed(Boolean(v))}
            />
            <span className="text-sm">Fijo</span>
            <Button onClick={handleSubmit}>
              {editingExpense ? "Guardar" : "Agregar"}
            </Button>
          </div>
        </div>
      </Card>
      {/* HISTORIAL */}
      <Card className="p-4">
        {/* HEADER + FILTROS */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Historial de gastos</h2>
            <span className="text-destructive font-semibold">
              Total: -€{totalExpenses.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterSubCategory}
              onValueChange={setFilterSubCategory}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filterCategory !== "all" &&
                  EXPENSE_CATEGORIES[
                    filterCategory as ExpenseMainCategory
                  ]?.sub.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px] justify-start">
                  {monthFilterLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-3" align="start">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelectedMonths([])}
                  >
                    Limpiar meses
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    {MONTH_OPTIONS.map((month) => (
                      <label
                        key={month.value}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedMonths.includes(month.value)}
                          onCheckedChange={() => toggleMonth(month.value)}
                        />
                        <span>{month.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {yearsOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={onlyFixed}
                onCheckedChange={(v) => setOnlyFixed(Boolean(v))}
              />
              <span className="text-sm">Solo fijos</span>
            </div>

            <div className="relative w-[260px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar (desc, categoría, tipo, fecha)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {paginatedExpenses.map((e) => (
          <div key={e.id} className="flex justify-between border-b py-2">
            <div>
              <p className="font-medium">{e.description || e.subCategory}</p>
              <p className="text-xs text-muted-foreground">
                {e.category} · {e.subCategory} · {e.date}
                {e.isFixed && <Badge className="ml-2">Fijo</Badge>}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-destructive">-€{e.amount.toFixed(2)}</span>
              <Pencil
                className="h-4 w-4 cursor-pointer"
                onClick={() => startEdit(e)}
              />
              <Trash2
                className="h-4 w-4 cursor-pointer text-destructive"
                onClick={() =>
                  confirm("¿Eliminar gasto?") &&
                  deleteExpense({
                    householdId: householdId!,
                    expenseId: e.id,
                  })
                }
              />
            </div>
          </div>
        ))}

        {/* PAGINACIÓN */}
        <div className="flex justify-center gap-3 mt-4">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="pt-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}


