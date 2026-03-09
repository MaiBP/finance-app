"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase.client";
import {
  addIncome,
  updateIncome,
  deleteIncome,
  subscribeToIncomes,
  getUserDoc,
} from "@/lib/firestore";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import type { Income, IncomeCategory, IncomeSubCategory } from "@/types/income";
import type { UserData } from "@/types/user";
import { INCOME_CATEGORIES } from "@/lib/income-categories";

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

export default function IncomesPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<IncomeCategory>("salario");
  const [subCategory, setSubCategory] = useState<IncomeSubCategory>("trabajo");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSubCategory, setFilterSubCategory] = useState("all");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [filterYear, setFilterYear] = useState("all");
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

      const unsubIncomes = subscribeToIncomes(userData.householdId, setIncomes);

      setLoading(false);
      return () => unsubIncomes();
    });

    return () => unsub();
  }, []);

  // editar
  const startEdit = (i: Income) => {
    setEditingIncome(i);
    setDate(i.date);
    setCategory(i.category);
    setSubCategory(i.subCategory);
    setDescription(i.description ?? "");
    setAmount(String(i.amount));
  };

  const resetForm = () => {
    setEditingIncome(null);
    setDate(new Date().toISOString().slice(0, 10));
    setCategory("salario");
    setSubCategory("trabajo");
    setDescription("");
    setAmount("");
  };

  const handleSubmit = async () => {
    if (!householdId || !amount) return;

    if (editingIncome) {
      await updateIncome({
        householdId,
        incomeId: editingIncome.id,
        data: {
          date,
          category,
          subCategory,
          description,
          amount: Number(amount),
        },
      });
    } else {
      await addIncome({
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

  const personalIncomes = useMemo(() => {
    if (!userId) return [];
    return incomes.filter((i) => i.createdByUid === userId);
  }, [incomes, userId]);

  const filteredIncomes = useMemo(() => {
    return personalIncomes.filter((i) => {
      if (filterCategory !== "all" && i.category !== filterCategory) return false;
      if (filterSubCategory !== "all" && i.subCategory !== filterSubCategory)
        return false;
      if (
        selectedMonths.length > 0 &&
        !selectedMonths.includes(i.date.slice(5, 7))
      )
        return false;
      if (filterYear !== "all" && i.date.slice(0, 4) !== filterYear) return false;

      if (search) {
        const q = search.toLowerCase();
        if (
          !i.description?.toLowerCase().includes(q) &&
          !i.category.includes(q) &&
          !i.subCategory.includes(q) &&
          !i.date.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    personalIncomes,
    search,
    filterCategory,
    filterSubCategory,
    selectedMonths,
    filterYear,
  ]);

  const totalIncomes = filteredIncomes.reduce((s, i) => s + i.amount, 0);

  const totalPages = Math.max(1, Math.ceil(filteredIncomes.length / PAGE_SIZE));

  const paginatedIncomes = filteredIncomes.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const yearsOptions = useMemo(() => {
    const years = new Set<string>();
    personalIncomes.forEach((i) => years.add(i.date.slice(0, 4)));

    if (years.size === 0) years.add(currentYear);

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [personalIncomes, currentYear]);

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Ingresos</h1>

      {/* AGREGAR INGRESO */}
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
                setCategory(v as IncomeCategory);
                setSubCategory(INCOME_CATEGORIES[v as IncomeCategory].sub[0].value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INCOME_CATEGORIES).map(([k, v]) => (
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
              onValueChange={(v) => setSubCategory(v as IncomeSubCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCOME_CATEGORIES[category].sub.map((s) => (
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

          <Button onClick={handleSubmit}>
            {editingIncome ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </Card>

      {/* HISTORIAL */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Historial de ingresos</h2>
            <span className="text-success font-semibold">
              Total: +€{totalIncomes.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(INCOME_CATEGORIES).map(([k, v]) => (
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
                  INCOME_CATEGORIES[filterCategory as IncomeCategory]?.sub.map((s) => (
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

        {paginatedIncomes.map((i) => (
          <div key={i.id} className="flex justify-between border-b py-2">
            <div>
              <p className="font-medium">{i.description || i.subCategory}</p>
              <p className="text-xs text-muted-foreground">
                {i.category} · {i.subCategory} · {i.date}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-success">+€{i.amount.toFixed(2)}</span>
              <Pencil
                className="h-4 w-4 cursor-pointer"
                onClick={() => startEdit(i)}
              />
              <Trash2
                className="h-4 w-4 cursor-pointer text-destructive"
                onClick={() =>
                  confirm("¿Eliminar ingreso?") &&
                  deleteIncome({ householdId: householdId!, incomeId: i.id })
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
