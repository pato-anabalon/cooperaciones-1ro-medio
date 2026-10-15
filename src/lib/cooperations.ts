export const EVENT_TITLE = "Convivencia 1° Medio";
export const EVENT_SUBTITLE = "Día del Profesor · lunes 19 de octubre";

export const categoryKeys = [
  "leches",
  "jugos",
  "sandwiches",
  "magdalenas",
  "compotas",
  "galletas",
] as const;

export type CategoryKey = (typeof categoryKeys)[number];
export type ItemStatus = "available" | "held" | "confirmed";

export type CooperationItem = {
  id: number;
  position: number;
  category: CategoryKey;
  description: string;
  status: ItemStatus;
  student_name: string | null;
  hold_expires_at: string | null;
  updated_at: string;
};

export type CategoryDefinition = {
  key: CategoryKey;
  name: string;
  description: string;
  icon: string;
  accent: string;
  count: number;
  firstPosition: number;
};

export const categories: CategoryDefinition[] = [
  {
    key: "leches",
    name: "Leches individuales",
    description: "1 pack de 6 leches",
    icon: "🥛",
    accent: "#4776e6",
    count: 8,
    firstPosition: 1,
  },
  {
    key: "jugos",
    name: "Jugos individuales",
    description: "1 pack de 6 jugos",
    icon: "🧃",
    accent: "#f29d38",
    count: 8,
    firstPosition: 9,
  },
  {
    key: "sandwiches",
    name: "Sándwiches",
    description: "6 sándwiches",
    icon: "🥪",
    accent: "#e86a5b",
    count: 8,
    firstPosition: 17,
  },
  {
    key: "magdalenas",
    name: "Magdalenas (queques)",
    description: "1 bolsa de 6 magdalenas",
    icon: "🧁",
    accent: "#9d6bd8",
    count: 8,
    firstPosition: 25,
  },
  {
    key: "compotas",
    name: "Compotas de fruta",
    description: "1 pack de 6 compotas",
    icon: "🍎",
    accent: "#43a978",
    count: 8,
    firstPosition: 33,
  },
  {
    key: "galletas",
    name: "Galletas",
    description: "2 paquetes grandes",
    icon: "🍪",
    accent: "#bd7645",
    count: 5,
    firstPosition: 41,
  },
];

export const TOTAL_ITEMS = categories.reduce(
  (total, category) => total + category.count,
  0,
);

export function createInitialItems(): CooperationItem[] {
  return categories.flatMap((category) =>
    Array.from({ length: category.count }, (_, index) => {
      const position = category.firstPosition + index;

      return {
        id: position,
        position,
        category: category.key,
        description: category.description,
        status: "available" as const,
        student_name: null,
        hold_expires_at: null,
        updated_at: new Date(0).toISOString(),
      };
    }),
  );
}

