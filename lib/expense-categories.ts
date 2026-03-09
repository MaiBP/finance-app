import type { ExpenseMainCategory, ExpenseSubCategory } from "@/types/expense";

export const EXPENSE_CATEGORIES: Record<
  ExpenseMainCategory,
  { label: string; sub: { value: ExpenseSubCategory; label: string }[] }
> = {
  hogar: {
    label: "Hogar",
    sub: [
      { value: "alquiler", label: "Alquiler" },
      { value: "hipoteca", label: "Hipoteca" },
      { value: "otros", label: "Otros" },
    ],
  },
  comida: {
    label: "Comida",
    sub: [
      { value: "supermercado", label: "Supermercado" },
      { value: "restaurante_bar", label: "Restaurante & Bar" },
      { value: "otros", label: "Otros" },
    ],
  },
  transporte: {
    label: "Transporte",
    sub: [
      { value: "metro", label: "Metro" },
      { value: "tren", label: "Tren" },
      { value: "avion", label: "Avión" },
      { value: "coche", label: "Coche" },
      { value: "bici", label: "Bici" },
      { value: "otros", label: "Otros" },
    ],
  },
  servicios: {
    label: "Servicios",
    sub: [
      { value: "luz", label: "Luz" },
      { value: "gas", label: "Gas" },
      { value: "agua", label: "Agua" },
      { value: "seguro", label: "Seguro" },
      { value: "otros", label: "Otros" },
    ],
  },
  salud: {
    label: "Salud",
    sub: [
      { value: "farmacia", label: "Farmacia" },
      { value: "medico", label: "Médico" },
      { value: "otros", label: "Otros" },
    ],
  },
  ocio: {
    label: "Ocio",
    sub: [
      { value: "cine", label: "Cine" },
      { value: "eventos", label: "Eventos" },
      { value: "deporte", label: "Deporte" },
      { value: "otros", label: "Otros" },
    ],
  },
  vacaciones: {
    label: "Vacaciones",
    sub: [
      { value: "vuelos", label: "Vuelos" },
      { value: "hotel", label: "Hotel" },
      { value: "comida", label: "Comida" },
      { value: "regalos", label: "Regalos" },
      { value: "atracciones", label: "Atracciones" },
      { value: "otros", label: "Otros" },
    ],
  },
};