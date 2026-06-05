// Normalizes any bank date format to "YYYY-MM-DD" — the whole app (month
// filters, index range queries, sorting) depends on that exact shape.
// Spanish banks use day-first: "02/05/2025" means May 2nd.
// Pure module (no deps) so both Convex runtimes can import it.

export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  // Excel date serial (days since 1900-01-01, with the 1900 leap-year bug)
  if (typeof value === "number" && value > 25569 && value < 80000) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }

  const s = String(value ?? "").trim();
  if (!s) return null;

  // Already ISO: YYYY-MM-DD (optionally with time suffix)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Day-first: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (also 2-digit years)
  const dayFirst = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dayFirst) {
    const [, d, m, y] = dayFirst;
    const year = y.length === 2 ? `20${y}` : y;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  return null; // unparseable → caller skips the row
}
