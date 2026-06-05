"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  getCategoryColor,
  SEED_CATEGORY_NAMES,
  type TaxonomyCategory,
} from "@/lib/taxonomy";

export function useTaxonomy(userId: string | null) {
  const taxonomy = useQuery(
    api.taxonomy.getUserTaxonomy,
    userId ? { userId } : "skip"
  );

  const activeCategories: TaxonomyCategory[] = useMemo(() => {
    if (!taxonomy) return [];
    return taxonomy.categories.filter((c) => c.isActive);
  }, [taxonomy]);

  // All category names for filter buttons: "Todas" + active categories
  const allCategoryNames: string[] = useMemo(() => {
    if (!taxonomy) return ["Todas", ...SEED_CATEGORY_NAMES];
    return ["Todas", ...activeCategories.map((c) => c.name)];
  }, [taxonomy, activeCategories]);

  function getColor(name: string) {
    return getCategoryColor(name, taxonomy ? activeCategories : null);
  }

  return {
    taxonomy,
    activeCategories,
    allCategoryNames,
    getColor,
    isLoaded: taxonomy !== undefined,
  };
}
