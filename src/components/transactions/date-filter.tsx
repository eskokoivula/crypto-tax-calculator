"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

const YEAR_PRESETS = [2023, 2024, 2025];

interface DateFilterProps {
  fromDate: Date | null;
  toDate: Date | null;
  onChange: (from: Date | null, to: Date | null) => void;
}

function toInputValue(date: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DateFilter({ fromDate, toDate, onChange }: DateFilterProps) {
  function setYear(year: number) {
    onChange(new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59));
  }

  function setAll() {
    onChange(null, null);
  }

  const activeYear =
    fromDate &&
    toDate &&
    fromDate.getMonth() === 0 &&
    fromDate.getDate() === 1 &&
    toDate.getMonth() === 11 &&
    toDate.getDate() === 31 &&
    fromDate.getFullYear() === toDate.getFullYear()
      ? fromDate.getFullYear()
      : null;

  const isAll = !fromDate && !toDate;

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />

      {YEAR_PRESETS.map((year) => (
        <button
          key={year}
          type="button"
          onClick={() => setYear(year)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            activeYear === year
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {year}
        </button>
      ))}

      <button
        type="button"
        onClick={setAll}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          isAll
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        All
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      <Input
        type="date"
        className="h-7 w-32 text-xs"
        value={toInputValue(fromDate)}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? new Date(val + "T00:00:00") : null, toDate);
        }}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        className="h-7 w-32 text-xs"
        value={toInputValue(toDate)}
        onChange={(e) => {
          const val = e.target.value;
          onChange(fromDate, val ? new Date(val + "T23:59:59") : null);
        }}
      />
    </div>
  );
}
