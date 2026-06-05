"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { useMonth } from "@/components/app/MonthContext";
import { useTaxonomy } from "@/hooks/useTaxonomy";

const MONTH_NAMES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2]);
  const month = parseInt(parts[1]) - 1;
  return `${day} ${MONTH_NAMES[month]}`;
}

const MENU_MAX_HEIGHT = 240;

type CategoryMenu = {
  id: Id<"transactions">;
  x: number;
  y: number;
  up: boolean;
  current: string;
};

export default function TransaccionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [menu, setMenu] = useState<CategoryMenu | null>(null);
  const { monthString } = useMonth();
  const { allCategoryNames, activeCategories, getColor } = useTaxonomy(userId);

  const updateCategory = useMutation(api.categoryRules.updateTransactionCategory);
  const setExcluded = useMutation(api.transactions.setTransactionExcluded);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  // Initialize filter from URL param ?cat=
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    if (cat) setCatFilter(cat); // validated against allCategoryNames when rendered
  }, []);

  const rawTransactions = useQuery(
    api.transactions.listTransactions,
    userId ? { userId } : "skip"
  );

  if (!userId || rawTransactions === undefined) {
    return <div style={{ color: "var(--text3)", fontSize: 13, padding: 20 }}>Cargando…</div>;
  }

  if (rawTransactions.length === 0) {
    return (
      <div style={{ color: "var(--text3)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
        No hay transacciones. Sube un extracto bancario en la sección Extractos.
      </div>
    );
  }

  const filtered = rawTransactions.filter((t) => {
    const matchMonth = t.date.startsWith(monthString);
    const matchCat = catFilter === "Todas" || t.category === catFilter;
    const haystack = (t.merchant || t.description).toLowerCase();
    const matchSearch = !search || haystack.includes(search.toLowerCase());
    return matchMonth && matchCat && matchSearch;
  });

  // Excluded transactions stay visible (greyed) but never count in totals
  const counted = filtered.filter((t) => t.excluded !== true);
  const totalIncome  = counted.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const totalExpense = counted.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);
  const excludedCount = filtered.length - counted.length;

  // Recategorize: the mutation updates this transaction + its siblings of the
  // same merchant, and saves a user rule so future uploads learn from it.
  async function handleSelectCategory(name: string) {
    if (!menu) return;
    const m = menu;
    setMenu(null);
    if (name === m.current) return;
    await updateCategory({
      transactionId: m.id,
      newCategory: name,
      isSubscription: name === "Suscripciones",
    });
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, id: Id<"transactions">, current: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const up = rect.bottom + MENU_MAX_HEIGHT + 12 > window.innerHeight;
    setMenu({
      id,
      x: rect.left,
      y: up ? rect.top - 6 : rect.bottom + 6,
      up,
      current,
    });
  }

  const pickableCategories = activeCategories.length > 0
    ? activeCategories.map((c) => c.name)
    : allCategoryNames.filter((c) => c !== "Todas");

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {allCategoryNames.map((c) => {
            const active = catFilter === c;
            const { color } = getColor(c);
            const showDot = c !== "Todas";
            return (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 100, fontSize: 12,
                  fontWeight: active ? 600 : 400, fontFamily: "inherit", cursor: "pointer",
                  border: active ? `1px solid ${color}` : "1px solid var(--border2)",
                  background: active ? "var(--card2)" : "var(--card)",
                  color: active ? "var(--text)" : "var(--text2)",
                  transition: "all 0.15s",
                }}
              >
                {showDot && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                )}
                {c}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 8, padding: "7px 12px" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="var(--text3)" strokeWidth="1.3"/>
            <path d="M9 9l2.5 2.5" stroke="var(--text3)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar comercio o descripción..."
            style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text)", fontFamily: "inherit", width: "100%" }}
          />
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, fontSize: 12, color: "var(--text2)", flexWrap: "wrap" }}>
        <span style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 100, padding: "3px 12px" }}>
          {counted.length} transacciones
        </span>
        <span style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 100, padding: "3px 12px", color: "var(--green)" }}>
          +{totalIncome.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€ ingresos
        </span>
        <span style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 100, padding: "3px 12px", color: "var(--red)" }}>
          {totalExpense.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€ gastos
        </span>
        {excludedCount > 0 && (
          <span style={{ background: "var(--card)", border: "1px dashed var(--border2)", borderRadius: 100, padding: "3px 12px", color: "var(--text3)" }}>
            {excludedCount} excluida{excludedCount !== 1 ? "s" : ""} del análisis
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 160px 100px 40px", padding: "10px 16px", background: "var(--card2)", borderBottom: "1px solid var(--border)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)" }}>
          <span>Fecha</span>
          <span>Descripción</span>
          <span>Categoría</span>
          <span style={{ textAlign: "right" }}>Importe</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
            No hay transacciones con estos filtros
          </div>
        ) : (
          filtered.map((t, i) => {
            const { color: dotColor } = getColor(t.category);
            const isExcluded = t.excluded === true;
            return (
              <div
                key={t._id}
                style={{ display: "grid", gridTemplateColumns: "90px 1fr 160px 100px 40px", padding: "9px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13, alignItems: "center", transition: "background 0.15s", opacity: isExcluded ? 0.45 : 1 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--card2)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                <span style={{ color: "var(--text3)", fontSize: 12 }}>{formatDate(t.date)}</span>
                <span style={{ color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12, textDecoration: isExcluded ? "line-through" : "none" }}>
                  {t.merchant || t.description}
                </span>

                {/* Editable category */}
                <button
                  onClick={(e) => openMenu(e, t._id, t.category)}
                  title="Cambiar categoría"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "1px solid transparent", borderRadius: 100,
                    padding: "3px 8px", margin: "-3px 0", cursor: "pointer",
                    fontFamily: "inherit", width: "fit-content", maxWidth: "100%",
                    transition: "border 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.border = "1px solid var(--border2)";
                    (e.currentTarget as HTMLElement).style.background = "var(--bg)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.border = "1px solid transparent";
                    (e.currentTarget as HTMLElement).style.background = "none";
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <span style={{ color: "var(--text2)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.category}</span>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1.5 3l2.5 2.5L6.5 3" stroke="var(--text3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <span style={{ textAlign: "right", fontWeight: 600, color: t.amount > 0 ? "var(--green)" : "var(--text)", fontSize: 13.5, textDecoration: isExcluded ? "line-through" : "none" }}>
                  {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                </span>

                {/* Exclude / include toggle */}
                <button
                  onClick={() => setExcluded({ transactionId: t._id, excluded: !isExcluded })}
                  title={isExcluded ? "Incluir en el análisis" : "Excluir del análisis"}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text3)", padding: 4, justifySelf: "end",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {isExcluded ? (
                    /* eye — re-include */
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M1.5 7.5S3.7 3.5 7.5 3.5s6 4 6 4-2.2 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                      <circle cx="7.5" cy="7.5" r="1.8" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  ) : (
                    /* eye-off — exclude */
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M2.6 4.5C1.8 5.6 1.5 6.5 1.5 6.5s2.2 4 6 4c.9 0 1.7-.2 2.4-.5M5.6 3C6.2 2.8 6.8 2.7 7.5 2.7c3.8 0 6 3.8 6 3.8s-.5 1-1.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 1.5l11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
            );
          })
        )}

        <div style={{ padding: "11px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text3)" }}>
          <span>Mostrando {filtered.length} de {rawTransactions.length} transacciones totales</span>
          <span>Haz clic en una categoría para corregirla — Yield aprende de tus cambios</span>
        </div>
      </div>

      {/* Category picker (fixed-position dropdown) */}
      {menu && (
        <>
          <div
            onClick={() => setMenu(null)}
            style={{ position: "fixed", inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: "fixed",
              left: menu.x,
              ...(menu.up ? { bottom: window.innerHeight - menu.y } : { top: menu.y }),
              zIndex: 100,
              background: "var(--card)",
              border: "1px solid var(--border2)",
              borderRadius: 10,
              boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
              maxHeight: MENU_MAX_HEIGHT,
              overflowY: "auto",
              minWidth: 180,
              padding: 4,
            }}
          >
            {pickableCategories.map((name) => {
              const { color } = getColor(name);
              const isCurrent = name === menu.current;
              return (
                <button
                  key={name}
                  onClick={() => handleSelectCategory(name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "7px 10px", borderRadius: 7, border: "none",
                    background: isCurrent ? "var(--card2)" : "none",
                    color: "var(--text)", fontSize: 12.5, fontFamily: "inherit",
                    cursor: "pointer", textAlign: "left",
                    fontWeight: isCurrent ? 600 : 400,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--card2)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = isCurrent ? "var(--card2)" : "none")}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  {name}
                  {isCurrent && <span style={{ marginLeft: "auto", color: "var(--green)", fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
