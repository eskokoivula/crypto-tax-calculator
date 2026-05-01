"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportModification } from "@/types";

interface ModificationPillsProps {
  modifications: ReportModification[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function ModificationPills({
  modifications,
  onToggle,
  onRemove,
  onClearAll,
}: ModificationPillsProps) {
  if (modifications.length === 0) return null;

  return (
    <div className="border-b border-border px-3 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {modifications.map((mod) => (
          <div
            key={mod.id}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
              "transition-colors",
              mod.active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card/30 text-muted-foreground"
            )}
          >
            {/* Toggle switch */}
            <button
              onClick={() => onToggle(mod.id)}
              className={cn(
                "relative h-3.5 w-6 shrink-0 rounded-full transition-colors cursor-pointer",
                mod.active ? "bg-primary" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
                  mod.active && "translate-x-2.5"
                )}
              />
            </button>

            <span className="truncate max-w-[140px]">{mod.description}</span>

            <button
              onClick={() => onRemove(mod.id)}
              className="shrink-0 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors cursor-pointer"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}

        {/* Clear all */}
        {modifications.length > 1 && (
          <button
            onClick={onClearAll}
            className={cn(
              "shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px]",
              "text-muted-foreground hover:text-destructive hover:border-destructive/40",
              "transition-colors cursor-pointer"
            )}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
