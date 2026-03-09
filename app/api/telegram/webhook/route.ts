import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase.admin";
import {
  answerTelegramCallbackQuery,
  getMainReplyKeyboard,
  parsePositiveAmount,
  parseTelegramFinanceCommand,
  sendTelegramMessage,
} from "@/lib/telegram";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { INCOME_CATEGORIES } from "@/lib/income-categories";
import type { ExpenseMainCategory } from "@/types/expense";
import type { IncomeCategory } from "@/types/income";

export const runtime = "nodejs";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number | string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number | string };
    };
  };
};

type TelegramLink = {
  uid: string;
  householdId: string;
  displayName: string;
};

type SessionStep =
  | "choose_category"
  | "choose_subcategory"
  | "enter_amount"
  | "enter_description"
  | "edit_menu"
  | "confirm";

type TelegramSession = {
  kind: "expense" | "income";
  step: SessionStep;
  mode?: "create" | "update";
  recordId?: string;
  category?: string;
  subCategory?: string;
  amount?: number;
  description?: string;
  updatedAt: number;
};

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function expenseCategoriesKeyboard() {
  const buttons = Object.entries(EXPENSE_CATEGORIES).map(([key, value]) => ({
    text: value.label,
    callback_data: `cat:expense:${key}`,
  }));
  return { inline_keyboard: chunk(buttons, 2) };
}

function incomeCategoriesKeyboard() {
  const buttons = Object.entries(INCOME_CATEGORIES).map(([key, value]) => ({
    text: value.label,
    callback_data: `cat:income:${key}`,
  }));
  return { inline_keyboard: chunk(buttons, 2) };
}

function expenseSubcategoriesKeyboard(category: ExpenseMainCategory) {
  const buttons = EXPENSE_CATEGORIES[category].sub.map((item) => ({
    text: item.label,
    callback_data: `sub:expense:${item.value}`,
  }));
  return { inline_keyboard: chunk(buttons, 2) };
}

function incomeSubcategoriesKeyboard(category: IncomeCategory) {
  const buttons = INCOME_CATEGORIES[category].sub.map((item) => ({
    text: item.label,
    callback_data: `sub:income:${item.value}`,
  }));
  return { inline_keyboard: chunk(buttons, 2) };
}

function confirmKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Guardar", callback_data: "confirm:save" },
        { text: "Cancelar", callback_data: "confirm:cancel" },
      ],
    ],
  };
}

function postSaveKeyboard(kind: "expense" | "income", recordId: string) {
  return {
    inline_keyboard: [
      [
        { text: "Editar", callback_data: `rec:edit:${kind}:${recordId}` },
        { text: "Borrar", callback_data: `rec:del:${kind}:${recordId}` },
      ],
    ],
  };
}

function editMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Editar monto", callback_data: "edit:amount" },
        { text: "Editar descripcion", callback_data: "edit:description" },
      ],
      [
        { text: "Guardar cambios", callback_data: "edit:save" },
        { text: "Cancelar", callback_data: "edit:cancel" },
      ],
    ],
  };
}

function balanceModeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Mensual", callback_data: "bal:period:monthly" },
        { text: "Anual", callback_data: "bal:period:yearly" },
      ],
      [{ text: "Acumulado", callback_data: "bal:period:all" }],
    ],
  };
}

function parseCsvMonths(raw: string) {
  if (!raw || raw === "0") return new Set<string>();
  const valid = new Set<string>(MONTHS.map((m) => m.key));
  return new Set(
    raw
      .split(",")
      .map((x) => x.trim())
      .filter((x) => valid.has(x)),
  );
}

function monthsToCsv(months: Set<string>) {
  if (months.size === 0) return "0";
  return Array.from(months).sort().join(",");
}

function monthlyPickerKeyboard(selected: Set<string>) {
  const buttons = MONTHS.map((month) => {
    const isSelected = selected.has(month.key);
    const next = new Set(selected);
    if (isSelected) next.delete(month.key);
    else next.add(month.key);
    return {
      text: `${isSelected ? "✅ " : ""}${month.label}`,
      callback_data: `bal:monthly:toggle:${month.key}:${monthsToCsv(next)}`,
    };
  });

  return {
    inline_keyboard: [
      ...chunk(buttons, 3),
      [
        { text: "Ver resultado", callback_data: `bal:monthly:show:${monthsToCsv(selected)}` },
      ],
      [{ text: "Limpiar", callback_data: "bal:period:monthly" }],
    ],
  };
}

function yearlyPickerKeyboard(years: string[]) {
  const buttons = years.map((year) => ({
    text: year,
    callback_data: `bal:year:show:${year}`,
  }));
  return { inline_keyboard: chunk(buttons, 3) };
}

function formatMoney(value: number, positiveSign = true) {
  const sign = value >= 0 ? (positiveSign ? "+" : "") : "-";
  return `${sign}EUR ${Math.abs(value).toFixed(2)}`;
}

async function getHouseholdMovements(householdId: string) {
  const [expenseSnap, incomeSnap] = await Promise.all([
    adminDb.collection("households").doc(householdId).collection("expenses").get(),
    adminDb.collection("households").doc(householdId).collection("incomes").get(),
  ]);

  const expenses = expenseSnap.docs.map((doc) => doc.data() as { amount: number; date?: string });
  const incomes = incomeSnap.docs.map((doc) => doc.data() as { amount: number; date?: string });

  return { expenses, incomes };
}

function buildBalanceText(
  title: string,
  expenses: { amount: number; date?: string }[],
  incomes: { amount: number; date?: string }[],
) {
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalIncomes = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const balance = totalIncomes - totalExpenses;

  return [
    title,
    `Ingresos: ${formatMoney(totalIncomes, true)}`,
    `Gastos: -EUR ${totalExpenses.toFixed(2)}`,
    `Balance: ${formatMoney(balance, true)}`,
  ].join("\n");
}

async function sendMonthlyBalance(chatId: string, link: TelegramLink, selectedCsv: string) {
  const year = String(new Date().getFullYear());
  const selected = parseCsvMonths(selectedCsv);
  if (selected.size === 0) {
    await sendTelegramMessage(
      chatId,
      "Selecciona al menos un mes para ver el balance mensual.",
      monthlyPickerKeyboard(selected),
    );
    return;
  }

  const { expenses, incomes } = await getHouseholdMovements(link.householdId);

  const filteredExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    return e.date.slice(0, 4) === year && selected.has(e.date.slice(5, 7));
  });
  const filteredIncomes = incomes.filter((i) => {
    if (!i.date) return false;
    return i.date.slice(0, 4) === year && selected.has(i.date.slice(5, 7));
  });

  const labels = MONTHS.filter((m) => selected.has(m.key))
    .map((m) => m.label)
    .join(", ");

  await sendTelegramMessage(
    chatId,
    buildBalanceText(`Balance mensual (${labels}) - ${year}`, filteredExpenses, filteredIncomes),
    getMainReplyKeyboard(),
  );
}

async function sendYearlyBalance(chatId: string, link: TelegramLink, year: string) {
  const { expenses, incomes } = await getHouseholdMovements(link.householdId);

  const filteredExpenses = expenses.filter((e) => e.date?.slice(0, 4) === year);
  const filteredIncomes = incomes.filter((i) => i.date?.slice(0, 4) === year);

  await sendTelegramMessage(
    chatId,
    buildBalanceText(`Balance anual (${year})`, filteredExpenses, filteredIncomes),
    getMainReplyKeyboard(),
  );
}

async function sendAccumulatedBalance(chatId: string, link: TelegramLink) {
  const { expenses, incomes } = await getHouseholdMovements(link.householdId);
  await sendTelegramMessage(
    chatId,
    buildBalanceText("Balance acumulado (todos los años)", expenses, incomes),
    getMainReplyKeyboard(),
  );
}

async function askYearlyBalance(chatId: string, link: TelegramLink) {
  const { expenses, incomes } = await getHouseholdMovements(link.householdId);

  const years = new Set<string>();
  for (const item of expenses) {
    if (item.date?.slice(0, 4)) years.add(item.date.slice(0, 4));
  }
  for (const item of incomes) {
    if (item.date?.slice(0, 4)) years.add(item.date.slice(0, 4));
  }

  const sortedYears = Array.from(years).sort((a, b) => Number(b) - Number(a));
  if (sortedYears.length === 0) {
    await sendTelegramMessage(
      chatId,
      "No hay movimientos con fecha para calcular balance anual.",
      getMainReplyKeyboard(),
    );
    return;
  }

  await sendTelegramMessage(chatId, "Selecciona un año:", yearlyPickerKeyboard(sortedYears));
}

async function getLink(chatId: string) {
  const snap = await adminDb.collection("telegram_links").doc(chatId).get();
  if (!snap.exists) return null;
  return snap.data() as TelegramLink;
}

function sessionRef(chatId: string) {
  return adminDb.collection("telegram_sessions").doc(chatId);
}

async function getSession(chatId: string) {
  const snap = await sessionRef(chatId).get();
  if (!snap.exists) return null;
  return snap.data() as TelegramSession;
}

async function saveSession(chatId: string, data: Partial<TelegramSession>) {
  const sanitized = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

  await sessionRef(chatId).set(
    {
      ...sanitized,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

async function clearSession(chatId: string) {
  await sessionRef(chatId).delete().catch(() => undefined);
}

async function handleLinkCommand(chatId: string, code: string) {
  const codeRef = adminDb.collection("telegram_link_codes").doc(code);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    await sendTelegramMessage(chatId, "Codigo invalido.", getMainReplyKeyboard());
    return;
  }

  const data = codeSnap.data() as {
    uid: string;
    householdId: string;
    displayName: string;
    expiresAt: number;
    usedAt: number | null;
  };

  if (data.usedAt) {
    await sendTelegramMessage(chatId, "Ese codigo ya fue usado.", getMainReplyKeyboard());
    return;
  }

  if (Date.now() > data.expiresAt) {
    await sendTelegramMessage(
      chatId,
      "Ese codigo expiro. Genera uno nuevo en la app.",
      getMainReplyKeyboard(),
    );
    return;
  }

  await adminDb.collection("telegram_links").doc(chatId).set({
    chatId,
    uid: data.uid,
    householdId: data.householdId,
    displayName: data.displayName,
    linkedAt: Date.now(),
    linkedAtServer: Date.now(),
  });

  await codeRef.update({
    usedAt: Date.now(),
    usedAtServer: Date.now(),
  });

  await sendTelegramMessage(
    chatId,
    "Chat vinculado. Usa los botones o escribe: 'gaste 200 en comida'.",
    getMainReplyKeyboard(),
  );
}

async function startFlow(chatId: string, kind: "expense" | "income") {
  await sessionRef(chatId).set({
    kind,
    mode: "create",
    recordId: null,
    step: "choose_category",
    updatedAt: Date.now(),
  });

  if (kind === "expense") {
    await sendTelegramMessage(
      chatId,
      "Selecciona categoria de gasto:",
      expenseCategoriesKeyboard(),
    );
  } else {
    await sendTelegramMessage(
      chatId,
      "Selecciona categoria de ingreso:",
      incomeCategoriesKeyboard(),
    );
  }
}

async function saveExpense(link: TelegramLink, session: TelegramSession) {
  const ref = await adminDb
    .collection("households")
    .doc(link.householdId)
    .collection("expenses")
    .add({
    householdId: link.householdId,
    createdByUid: link.uid,
    createdByName: link.displayName,
    category: session.category,
    subCategory: session.subCategory,
    description: session.description || "",
    amount: session.amount,
    isFixed: false,
    date: todayISO(),
    createdAt: Date.now(),
    createdAtServer: Date.now(),
    source: "telegram",
  });
  return ref.id;
}

async function saveIncome(link: TelegramLink, session: TelegramSession) {
  const ref = await adminDb
    .collection("households")
    .doc(link.householdId)
    .collection("incomes")
    .add({
    householdId: link.householdId,
    createdByUid: link.uid,
    createdByName: link.displayName,
    category: session.category,
    subCategory: session.subCategory,
    description: session.description || "",
    amount: session.amount,
    date: todayISO(),
    createdAt: Date.now(),
    createdAtServer: Date.now(),
    source: "telegram",
  });
  return ref.id;
}

async function updateExpense(link: TelegramLink, session: TelegramSession) {
  if (!session.recordId) throw new Error("Missing recordId for expense update");

  await adminDb
    .collection("households")
    .doc(link.householdId)
    .collection("expenses")
    .doc(session.recordId)
    .update({
      amount: session.amount,
      description: session.description || "",
      updatedAt: Date.now(),
      updatedFrom: "telegram",
    });
}

async function updateIncome(link: TelegramLink, session: TelegramSession) {
  if (!session.recordId) throw new Error("Missing recordId for income update");

  await adminDb
    .collection("households")
    .doc(link.householdId)
    .collection("incomes")
    .doc(session.recordId)
    .update({
      amount: session.amount,
      description: session.description || "",
      updatedAt: Date.now(),
      updatedFrom: "telegram",
    });
}

function buildSummary(session: TelegramSession) {
  const amount = session.amount?.toFixed(2) ?? "0.00";
  const sign = session.kind === "expense" ? "-" : "+";
  const description = session.description || "(sin descripcion)";
  return [
    "Confirma el movimiento:",
    `${session.kind === "expense" ? "Gasto" : "Ingreso"}: ${sign}EUR ${amount}`,
    `Categoria: ${session.category}`,
    `Tipo: ${session.subCategory}`,
    `Descripcion: ${description}`,
  ].join("\n");
}

function buildEditSummary(session: TelegramSession) {
  const amount = session.amount?.toFixed(2) ?? "0.00";
  const sign = session.kind === "expense" ? "-" : "+";
  const description = session.description || "(sin descripcion)";
  return [
    "Editar movimiento:",
    `${session.kind === "expense" ? "Gasto" : "Ingreso"}: ${sign}EUR ${amount}`,
    `Categoria: ${session.category}`,
    `Tipo: ${session.subCategory}`,
    `Descripcion: ${description}`,
    "",
    "Selecciona que deseas editar o guarda cambios.",
  ].join("\n");
}

async function handleCallback(update: TelegramUpdate) {
  const callback = update.callback_query;
  if (!callback?.id || !callback.data || !callback.message?.chat?.id) return;

  const chatId = String(callback.message.chat.id);
  await answerTelegramCallbackQuery(callback.id).catch(() => undefined);

  const link = await getLink(chatId);
  if (!link) {
    await clearSession(chatId);
    await sendTelegramMessage(
      chatId,
      "Este chat no esta vinculado. Primero ejecuta: /vincular CODIGO",
      getMainReplyKeyboard(),
    );
    return;
  }

  if (callback.data === "bal:period:monthly") {
    await sendTelegramMessage(
      chatId,
      "Selecciona uno o varios meses:",
      monthlyPickerKeyboard(new Set<string>()),
    );
    return;
  }

  if (callback.data === "bal:period:yearly") {
    await askYearlyBalance(chatId, link);
    return;
  }

  if (callback.data === "bal:period:all") {
    await sendAccumulatedBalance(chatId, link);
    return;
  }

  if (callback.data.startsWith("bal:monthly:toggle:")) {
    const match = callback.data.match(/^bal:monthly:toggle:(\d{2}):(.*)$/);
    if (!match) return;
    const selected = parseCsvMonths(match[2] || "0");
    await sendTelegramMessage(
      chatId,
      "Selecciona uno o varios meses:",
      monthlyPickerKeyboard(selected),
    );
    return;
  }

  if (callback.data.startsWith("bal:monthly:show:")) {
    const selectedCsv = callback.data.replace(/^bal:monthly:show:/, "");
    await sendMonthlyBalance(chatId, link, selectedCsv || "0");
    return;
  }

  if (callback.data.startsWith("bal:year:show:")) {
    const year = callback.data.replace(/^bal:year:show:/, "");
    if (!/^\d{4}$/.test(year)) return;
    await sendYearlyBalance(chatId, link, year);
    return;
  }

  if (callback.data.startsWith("rec:")) {
    const [, action, kind, recordId] = callback.data.split(":");
    if (!action || !kind || !recordId) return;

    if (action === "del") {
      const collectionName = kind === "expense" ? "expenses" : "incomes";
      await adminDb
        .collection("households")
        .doc(link.householdId)
        .collection(collectionName)
        .doc(recordId)
        .delete();

      await clearSession(chatId);
      await sendTelegramMessage(chatId, "Movimiento eliminado.", getMainReplyKeyboard());
      return;
    }

    if (action === "edit") {
      const collectionName = kind === "expense" ? "expenses" : "incomes";
      const docSnap = await adminDb
        .collection("households")
        .doc(link.householdId)
        .collection(collectionName)
        .doc(recordId)
        .get();

      if (!docSnap.exists) {
        await sendTelegramMessage(chatId, "No se encontró el movimiento.");
        return;
      }

      const data = docSnap.data() as {
        category: string;
        subCategory: string;
        amount: number;
        description?: string;
      };

      const sessionData: Partial<TelegramSession> = {
        kind: kind as "expense" | "income",
        mode: "update",
        recordId,
        category: data.category,
        subCategory: data.subCategory,
        amount: data.amount,
        description: data.description || "",
        step: "edit_menu",
      };

      await saveSession(chatId, sessionData);
      await sendTelegramMessage(
        chatId,
        buildEditSummary(sessionData as TelegramSession),
        editMenuKeyboard(),
      );
      return;
    }
  }

  const session = await getSession(chatId);
  if (!session) {
    await sendTelegramMessage(chatId, "Inicia con /gasto o /ingreso.", getMainReplyKeyboard());
    return;
  }

  if (callback.data.startsWith("cat:")) {
    const [, kind, category] = callback.data.split(":");
    if (kind !== session.kind) return;

    await saveSession(chatId, {
      category,
      subCategory: undefined,
      step: "choose_subcategory",
    });

    if (kind === "expense") {
      await sendTelegramMessage(
        chatId,
        "Selecciona tipo de gasto:",
        expenseSubcategoriesKeyboard(category as ExpenseMainCategory),
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "Selecciona tipo de ingreso:",
        incomeSubcategoriesKeyboard(category as IncomeCategory),
      );
    }
    return;
  }

  if (callback.data.startsWith("sub:")) {
    const [, kind, subCategory] = callback.data.split(":");
    if (kind !== session.kind) return;

    await saveSession(chatId, {
      subCategory,
      step: "enter_amount",
    });

    await sendTelegramMessage(chatId, "Escribe el monto. Ejemplo: 123.45", getMainReplyKeyboard());
    return;
  }

  if (callback.data === "edit:amount") {
    if (session.mode !== "update") return;
    await saveSession(chatId, { step: "enter_amount" });
    await sendTelegramMessage(chatId, "Escribe el nuevo monto:", getMainReplyKeyboard());
    return;
  }

  if (callback.data === "edit:description") {
    if (session.mode !== "update") return;
    await saveSession(chatId, { step: "enter_description" });
    await sendTelegramMessage(
      chatId,
      "Escribe la nueva descripcion (o '-' para vacia):",
      getMainReplyKeyboard(),
    );
    return;
  }

  if (callback.data === "edit:cancel") {
    await clearSession(chatId);
    await sendTelegramMessage(chatId, "Edicion cancelada.", getMainReplyKeyboard());
    return;
  }

  if (callback.data === "edit:save") {
    if (session.mode !== "update" || !session.recordId || !session.amount) {
      await sendTelegramMessage(chatId, "No hay una edicion activa.");
      await clearSession(chatId);
      return;
    }

    if (session.kind === "expense") {
      await updateExpense(link, session);
      await sendTelegramMessage(
        chatId,
        `Gasto actualizado: -EUR ${session.amount.toFixed(2)}`,
        postSaveKeyboard("expense", session.recordId),
      );
    } else {
      await updateIncome(link, session);
      await sendTelegramMessage(
        chatId,
        `Ingreso actualizado: +EUR ${session.amount.toFixed(2)}`,
        postSaveKeyboard("income", session.recordId),
      );
    }

    await clearSession(chatId);
    return;
  }

  if (callback.data === "confirm:cancel") {
    await clearSession(chatId);
    await sendTelegramMessage(chatId, "Operacion cancelada.", getMainReplyKeyboard());
    return;
  }

  if (callback.data === "confirm:save") {
    if (!session.category || !session.subCategory || !session.amount) {
      await sendTelegramMessage(chatId, "Faltan datos. Inicia nuevamente con /gasto o /ingreso.");
      await clearSession(chatId);
      return;
    }

    if (session.kind === "expense") {
      let recordId = session.recordId || "";
      if (session.mode === "update") {
        await updateExpense(link, session);
      } else {
        recordId = await saveExpense(link, session);
      }
      await sendTelegramMessage(
        chatId,
        `Gasto ${session.mode === "update" ? "actualizado" : "registrado"}: -EUR ${session.amount.toFixed(2)}`,
        recordId ? postSaveKeyboard("expense", recordId) : getMainReplyKeyboard(),
      );
    } else {
      let recordId = session.recordId || "";
      if (session.mode === "update") {
        await updateIncome(link, session);
      } else {
        recordId = await saveIncome(link, session);
      }
      await sendTelegramMessage(
        chatId,
        `Ingreso ${session.mode === "update" ? "actualizado" : "registrado"}: +EUR ${session.amount.toFixed(2)}`,
        recordId ? postSaveKeyboard("income", recordId) : getMainReplyKeyboard(),
      );
    }

    await clearSession(chatId);
  }
}

async function handleMessage(update: TelegramUpdate) {
  const messageText = update.message?.text?.trim();
  const chatId = String(update.message?.chat?.id ?? "");
  if (!chatId || !messageText) return;

  if (/^\/start\b/i.test(messageText)) {
    await sendTelegramMessage(
      chatId,
      "Hola. Para vincular este chat usa /vincular CODIGO.",
      getMainReplyKeyboard(),
    );
    return;
  }

  const linkMatch = messageText.match(/^\/vincular\s+([A-Z0-9]{4,12})$/i);
  if (linkMatch) {
    await handleLinkCommand(chatId, linkMatch[1].toUpperCase());
    return;
  }

  const link = await getLink(chatId);
  if (!link) {
    await clearSession(chatId);
    await sendTelegramMessage(
      chatId,
      "Este chat no esta vinculado. Primero ejecuta: /vincular CODIGO",
      getMainReplyKeyboard(),
    );
    return;
  }

  const normalized = messageText.toLowerCase();
  const compact = normalized.replace(/\s+/g, " ").trim();

  if (/^\/cancelar\b/.test(compact) || compact.includes("cancelar")) {
    await clearSession(chatId);
    await sendTelegramMessage(chatId, "Operacion cancelada.", getMainReplyKeyboard());
    return;
  }

  if (
    /^\/gasto\b/.test(compact) ||
    compact === "gasto" ||
    (compact.includes("gasto") && compact.includes("➖"))
  ) {
    await startFlow(chatId, "expense");
    return;
  }

  if (
    /^\/ingreso\b/.test(compact) ||
    compact === "ingreso" ||
    (compact.includes("ingreso") && compact.includes("➕"))
  ) {
    await startFlow(chatId, "income");
    return;
  }

  if (
    /^\/balance\b/.test(compact) ||
    compact === "mostrar balance" ||
    (compact.includes("mostrar balance") && compact.includes("balance"))
  ) {
    await sendTelegramMessage(chatId, "Elige el periodo del balance:", balanceModeKeyboard());
    return;
  }

  const session = await getSession(chatId);
  if (session) {
    if (session.step === "enter_amount") {
      const amount = parsePositiveAmount(messageText);
      if (!amount) {
        await sendTelegramMessage(chatId, "Monto invalido. Ejemplo: 123.45", getMainReplyKeyboard());
        return;
      }

      if (session.mode === "update") {
        const updated: TelegramSession = {
          ...session,
          amount,
        };
        await saveSession(chatId, { amount, step: "edit_menu" });
        await sendTelegramMessage(chatId, buildEditSummary(updated), editMenuKeyboard());
      } else {
        await saveSession(chatId, {
          amount,
          step: "enter_description",
        });

        await sendTelegramMessage(
          chatId,
          "Escribe una descripcion (o '-' para omitir).",
          getMainReplyKeyboard(),
        );
      }
      return;
    }

    if (session.step === "enter_description") {
      const description = messageText === "-" ? "" : messageText;
      if (session.mode === "update") {
        const updated: TelegramSession = {
          ...session,
          description,
        };
        await saveSession(chatId, {
          description,
          step: "edit_menu",
        });
        await sendTelegramMessage(chatId, buildEditSummary(updated), editMenuKeyboard());
      } else {
        const merged: TelegramSession = {
          ...session,
          description,
          step: "confirm",
        };

        await saveSession(chatId, {
          description,
          step: "confirm",
        });

        await sendTelegramMessage(chatId, buildSummary(merged), confirmKeyboard());
      }
      return;
    }

    if (session.step === "edit_menu") {
      await sendTelegramMessage(chatId, "Usa los botones de edicion (Monto, Descripcion, Guardar, Cancelar).");
      return;
    }

    if (session.step === "confirm") {
      await sendTelegramMessage(chatId, "Usa Guardar o Cancelar en los botones.");
      return;
    }

    await sendTelegramMessage(chatId, "Selecciona categoria/tipo usando los botones.");
    return;
  }

  const parsed = parseTelegramFinanceCommand(messageText);
  if (!parsed) {
    await sendTelegramMessage(
      chatId,
      "No entendi el comando. Usa /gasto, /ingreso, /balance o texto tipo: 'gaste 200 en comida'.",
      getMainReplyKeyboard(),
    );
    return;
  }

  if (parsed.kind === "expense") {
    const ref = await adminDb
      .collection("households")
      .doc(link.householdId)
      .collection("expenses")
      .add({
      householdId: link.householdId,
      createdByUid: link.uid,
      createdByName: link.displayName,
      category: parsed.category,
      subCategory: parsed.subCategory,
      description: parsed.description,
      amount: parsed.amount,
      isFixed: false,
      date: todayISO(),
      createdAt: Date.now(),
      createdAtServer: Date.now(),
      source: "telegram",
    });

    await sendTelegramMessage(
      chatId,
      `Gasto registrado: -EUR ${parsed.amount.toFixed(2)} en ${parsed.description}`,
      postSaveKeyboard("expense", ref.id),
    );
  } else {
    const ref = await adminDb
      .collection("households")
      .doc(link.householdId)
      .collection("incomes")
      .add({
      householdId: link.householdId,
      createdByUid: link.uid,
      createdByName: link.displayName,
      category: parsed.category,
      subCategory: parsed.subCategory,
      description: parsed.description,
      amount: parsed.amount,
      date: todayISO(),
      createdAt: Date.now(),
      createdAtServer: Date.now(),
      source: "telegram",
    });

    await sendTelegramMessage(
      chatId,
      `Ingreso registrado: +EUR ${parsed.amount.toFixed(2)} en ${parsed.description}`,
      postSaveKeyboard("income", ref.id),
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret) {
      const secret = request.headers.get("x-telegram-bot-api-secret-token");
      if (secret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const update = (await request.json()) as TelegramUpdate;

    if (update.callback_query) {
      await handleCallback(update);
      return NextResponse.json({ ok: true });
    }

    if (update.message) {
      await handleMessage(update);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("telegram/webhook POST error:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
