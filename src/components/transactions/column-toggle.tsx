"use client";

import { useUiStore } from "@/store/ui-store";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LayoutGridIcon } from "lucide-react";

const COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  chain: "Chain",
  token: "Token",
  amount: "Amount",
  valueEur: "EUR Value",
  category: "Category",
  gasFee: "Fees",
  gainLoss: "Gain/Loss",
  wallet: "Wallet",
  source: "Source",
  warnings: "Warnings",
};

export function ColumnToggle() {
  const { columnVisibility, toggleColumnVisibility, resetColumnVisibility } =
    useUiStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
        <LayoutGridIcon className="size-3.5" />
        Columns
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Toggle columns</div>
        {Object.entries(COLUMN_LABELS).map(([key, label]) => (
          <DropdownMenuCheckboxItem
            key={key}
            checked={columnVisibility[key] !== false}
            onCheckedChange={() => toggleColumnVisibility(key)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={false}
          onCheckedChange={resetColumnVisibility}
        >
          Reset to defaults
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
