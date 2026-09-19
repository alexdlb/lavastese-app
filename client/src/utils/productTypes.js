// Tipi prodotto (dolce / salato) e relativi colori, condivisi tra Prodotti, Nuovo ordine e Agenda
export const PRODUCT_TYPES = {
  dolce: {
    label: "Dolce",
    icon: "🍰",
    accent: "#ec4899",
    bg: "#fdf2f8",
    headerBg: "#fce7f3",
    color: "#9d174d",
  },
  salato: {
    label: "Salato",
    icon: "🥖",
    accent: "#f97316",
    bg: "#fff7ed",
    headerBg: "#ffedd5",
    color: "#9a3412",
  },
};

export const DEFAULT_PRODUCT_TYPE = "dolce";
