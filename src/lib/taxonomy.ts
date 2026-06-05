export type TaxonomyCategory = {
  id: string;
  name: string;
  description: string;
  color: string;
  trackColor: string;
  examples: string[];
  isDefault: boolean;
  isActive: boolean;
};

export type UserTaxonomy = {
  _id: string;
  userId: string;
  generatedAt: number;
  lastExpansionAt?: number;
  categories: TaxonomyCategory[];
};

// Fallback seed colors used when taxonomy hasn't loaded yet
export const SEED_COLORS: Record<string, { color: string; trackColor: string }> = {
  Supermercado:  { color: "#1A6E3C",  trackColor: "rgba(26,110,60,0.13)" },
  Transporte:    { color: "#1E3D2C",  trackColor: "rgba(30,61,44,0.13)" },
  Restaurantes:  { color: "#9B8EC4",  trackColor: "rgba(155,142,196,0.13)" },
  Ocio:          { color: "#A83030",  trackColor: "rgba(168,48,48,0.13)" },
  Suscripciones: { color: "#E8A87C",  trackColor: "rgba(232,168,124,0.13)" },
  Ingresos:      { color: "#3B9EDB",  trackColor: "rgba(59,158,219,0.13)" },
  Otros:         { color: "#7A6F66",  trackColor: "rgba(122,111,102,0.13)" },
};

export const SEED_CATEGORY_NAMES = Object.keys(SEED_COLORS);

// Color pool for new (non-seed) categories, assigned in order
export const CUSTOM_COLOR_POOL: { color: string; trackColor: string }[] = [
  { color: "#2A7B7B", trackColor: "rgba(42,123,123,0.13)" },
  { color: "#B8860B", trackColor: "rgba(184,134,11,0.13)" },
  { color: "#4B5FA6", trackColor: "rgba(75,95,166,0.13)" },
  { color: "#C4605A", trackColor: "rgba(196,96,90,0.13)" },
  { color: "#6B7A3C", trackColor: "rgba(107,122,60,0.13)" },
  { color: "#8B5E3C", trackColor: "rgba(139,94,60,0.13)" },
  { color: "#546878", trackColor: "rgba(84,104,120,0.13)" },
  { color: "#7B4A6E", trackColor: "rgba(123,74,110,0.13)" },
];

export function getCategoryColor(
  categoryName: string,
  taxonomy?: TaxonomyCategory[] | null
): { color: string; trackColor: string } {
  if (taxonomy) {
    const found = taxonomy.find((c) => c.name === categoryName && c.isActive);
    if (found) return { color: found.color, trackColor: found.trackColor };
  }
  return SEED_COLORS[categoryName] ?? { color: "#7A6F66", trackColor: "rgba(122,111,102,0.13)" };
}

// Assign a color from the pool to a new custom category based on how many custom categories already exist
export function assignCustomColor(existingCustomCount: number): { color: string; trackColor: string } {
  return CUSTOM_COLOR_POOL[existingCustomCount % CUSTOM_COLOR_POOL.length];
}

// Normalize a category name to a stable slug id
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
