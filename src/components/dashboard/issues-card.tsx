"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";

interface IssuesCardProps {
  issueCount: number;
  errorCount: number;
  warningCount: number;
}

export function IssuesCard({
  issueCount,
  errorCount,
  warningCount,
}: IssuesCardProps) {
  if (issueCount === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Info className="size-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              No issues found
            </p>
            <p className="text-xs text-muted-foreground">
              All transactions look good
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/transactions?filter=issues"
      className="block rounded-xl border border-amber-500/30 bg-card p-5 transition-colors hover:border-amber-500/50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
            <AlertTriangle className="size-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {issueCount} {issueCount === 1 ? "issue requires" : "issues require"}{" "}
              attention
            </p>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              {errorCount > 0 && (
                <span className="flex items-center gap-1">
                  <AlertCircle className="size-3 text-red-400" />
                  {errorCount} {errorCount === 1 ? "error" : "errors"}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="size-3 text-amber-400" />
                  {warningCount} {warningCount === 1 ? "warning" : "warnings"}
                </span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
