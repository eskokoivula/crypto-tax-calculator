"use client";

import { useState } from "react";
import { CATEGORY_COLORS, type TaxCategory } from "@/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PencilIcon } from "lucide-react";

const CATEGORY_LABELS: Record<TaxCategory, string> = {
  disposal: "Disposal",
  income: "Income",
  transfer: "Transfer",
  purchase: "Purchase",
};

const CATEGORY_BG: Record<TaxCategory, string> = {
  disposal: "bg-red-500/15 text-red-400 border-red-500/30",
  income: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  transfer: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  purchase: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

interface CategoryBadgeProps {
  category: TaxCategory;
  overrideCategory?: TaxCategory;
  onOverride: (category: TaxCategory) => void;
}

export function CategoryBadge({
  category,
  overrideCategory,
  onOverride,
}: CategoryBadgeProps) {
  const effective = overrideCategory ?? category;
  const isOverridden = overrideCategory != null && overrideCategory !== category;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors",
          CATEGORY_BG[effective],
          isOverridden && "ring-1 ring-yellow-500/40"
        )}
      >
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: CATEGORY_COLORS[effective] }}
        />
        {CATEGORY_LABELS[effective]}
        <PencilIcon className="ml-0.5 size-2.5 opacity-0 transition-opacity group-hover:opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Set category</div>
        {(Object.keys(CATEGORY_LABELS) as TaxCategory[]).map((cat) => (
          <DropdownMenuItem
            key={cat}
            onClick={() => onOverride(cat)}
            className={cn(effective === cat && "bg-accent")}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            {CATEGORY_LABELS[cat]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
