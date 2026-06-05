"use client";

import { createContext, useContext, useState } from "react";

type MonthContextValue = {
  monthIdx: number;   // 0–11
  year: number;
  monthString: string; // "YYYY-MM"
  setMonth: (monthIdx: number, year: number) => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  function setMonth(newIdx: number, newYear: number) {
    setMonthIdx(newIdx);
    setYear(newYear);
  }

  const monthString = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;

  return (
    <MonthContext.Provider value={{ monthIdx, year, monthString, setMonth }}>
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be inside MonthProvider");
  return ctx;
}
