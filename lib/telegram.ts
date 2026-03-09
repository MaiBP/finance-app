import type { ExpenseMainCategory, ExpenseSubCategory } from "@/types/expense";
import type { IncomeCategory, IncomeSubCategory } from "@/types/income";

export type ParsedTelegramCommand =
  | {
      kind: "expense";
      amount: number;
      description: string;
      category: ExpenseMainCategory;
      subCategory: ExpenseSubCategory;
    }
  | {
      kind: "income";
      amount: number;
      description: string;
      category: IncomeCategory;
      subCategory: IncomeSubCategory;
    };

export type TelegramReplyMarkup =
  | {
      keyboard: { text: string }[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    }
  | {
      inline_keyboard: { text: string; callback_data: string }[][];
    };

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseAmount(raw: string) {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parsePositiveAmount(raw: string) {
  return parseAmount(raw);
}

function mapExpenseCategory(detail: string): {
  category: ExpenseMainCategory;
  subCategory: ExpenseSubCategory;
} {
  const text = normalize(detail);

  if (/super|supermercado/.test(text))
    return { category: "comida", subCategory: "supermercado" };
  if (/restaurante|bar|caf[eé]|comida/.test(text))
    return { category: "comida", subCategory: "restaurante_bar" };
  if (/alquiler/.test(text))
    return { category: "hogar", subCategory: "alquiler" };
  if (/hipoteca/.test(text))
    return { category: "hogar", subCategory: "hipoteca" };
  if (/metro/.test(text))
    return { category: "transporte", subCategory: "metro" };
  if (/tren/.test(text))
    return { category: "transporte", subCategory: "tren" };
  if (/avion|vuelo/.test(text))
    return { category: "transporte", subCategory: "avion" };
  if (/coche|auto|nafta|gasolina/.test(text))
    return { category: "transporte", subCategory: "coche" };
  if (/bici|bicicleta/.test(text))
    return { category: "transporte", subCategory: "bici" };
  if (/luz/.test(text)) return { category: "servicios", subCategory: "luz" };
  if (/gas/.test(text)) return { category: "servicios", subCategory: "gas" };
  if (/agua/.test(text)) return { category: "servicios", subCategory: "agua" };
  if (/seguro/.test(text))
    return { category: "servicios", subCategory: "seguro" };
  if (/farmacia/.test(text))
    return { category: "salud", subCategory: "farmacia" };
  if (/medico|doctor/.test(text))
    return { category: "salud", subCategory: "medico" };
  if (
    /fisioterapia|fisio|kinesiologia|kinesiologo|terapia|psicologo|psicologa/.test(
      text,
    )
  ) {
    return { category: "salud", subCategory: "otros" };
  }
  if (/cine/.test(text)) return { category: "ocio", subCategory: "cine" };
  if (/evento|show|concierto/.test(text))
    return { category: "ocio", subCategory: "eventos" };
  if (/deporte|gym|gimnasio/.test(text))
    return { category: "ocio", subCategory: "deporte" };
  if (/hotel/.test(text))
    return { category: "vacaciones", subCategory: "hotel" };
  if (/regalo/.test(text))
    return { category: "vacaciones", subCategory: "regalos" };
  if (/atraccion|museo|parque/.test(text))
    return { category: "vacaciones", subCategory: "atracciones" };

  return { category: "ocio", subCategory: "otros" };
}

function mapIncomeCategory(detail: string): {
  category: IncomeCategory;
  subCategory: IncomeSubCategory;
} {
  const text = normalize(detail);

  if (/salario|sueldo|nomina|trabajo/.test(text))
    return { category: "salario", subCategory: "trabajo" };
  if (/paga extra|aguinaldo/.test(text))
    return { category: "extras", subCategory: "paga_extra" };
  if (/reintegro|devolucion/.test(text))
    return { category: "extras", subCategory: "reintegros" };
  if (/cash|efectivo/.test(text))
    return { category: "efectivo", subCategory: "cash" };

  return { category: "extras", subCategory: "bonus" };
}

export function parseTelegramFinanceCommand(
  messageText: string,
): ParsedTelegramCommand | null {
  const text = normalize(messageText);

  const expenseMatch = text.match(
    /^(gaste|gasto|pague)\s+([0-9]+(?:[.,][0-9]+)?)\s+(?:en|de)\s+(.+)$/,
  );
  if (expenseMatch) {
    const amount = parseAmount(expenseMatch[2]);
    const description = expenseMatch[3].trim();
    if (!amount || !description) return null;
    const mapped = mapExpenseCategory(description);
    return {
      kind: "expense",
      amount,
      description,
      category: mapped.category,
      subCategory: mapped.subCategory,
    };
  }

  const incomeMatch = text.match(
    /^(ingrese|ingreso|cobre|recibi)\s+([0-9]+(?:[.,][0-9]+)?)\s+(?:en|de)\s+(.+)$/,
  );
  if (incomeMatch) {
    const amount = parseAmount(incomeMatch[2]);
    const description = incomeMatch[3].trim();
    if (!amount || !description) return null;
    const mapped = mapIncomeCategory(description);
    return {
      kind: "income",
      amount,
      description,
      category: mapped.category,
      subCategory: mapped.subCategory,
    };
  }

  return null;
}

async function telegramApi<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram ${method} failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: TelegramReplyMarkup,
) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function answerTelegramCallbackQuery(callbackQueryId: string) {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
  });
}

export function getMainReplyKeyboard(): TelegramReplyMarkup {
  return {
    keyboard: [
      [{ text: "➖ Gasto" }, { text: "➕ Ingreso" }],
      [{ text: "📊 Mostrar balance" }],
      [{ text: "❌ Cancelar" }],
    ],
    resize_keyboard: true,
  };
}

export function generateLinkCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
