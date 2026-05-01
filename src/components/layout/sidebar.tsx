"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboardIcon,
  ArrowLeftRightIcon,
  CoinsIcon,
  FileTextIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  UploadIcon,
  ScanSearchIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WalletManager } from "@/components/wallet/wallet-manager";
// ImportModal is rendered at root layout level, not inside sidebar
import { useUiStore } from "@/store/ui-store";
import { useWalletStore } from "@/store/wallet-store";
import { useTransactionStore } from "@/store/transaction-store";
import { usePipeline } from "@/hooks/use-pipeline";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRightIcon },
  { href: "/holdings", label: "Holdings", icon: CoinsIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
] as const;

interface SidebarProps {
  onImportClick?: () => void;
}

export function Sidebar({ onImportClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, setSidebarCollapsed, setActiveTab } = useUiStore();
  const { wallets, taxYear, setTaxYear } = useWalletStore();
  const { loading } = useTransactionStore();
  const { run } = usePipeline();

  const hasEnabledWallets = wallets.some((w) => w.enabled);

  function handleNav(href: string, tab: string) {
    setActiveTab(tab as "dashboard" | "transactions" | "holdings" | "reports");
    router.push(href);
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border/50 bg-card transition-[width] duration-200",
        sidebarCollapsed ? "w-16" : "w-[280px]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border/50 px-4",
          sidebarCollapsed && "justify-center px-0"
        )}
      >
        {sidebarCollapsed ? (
          <span className="text-lg font-bold text-primary">CT</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              CryptoTax{" "}
              <span className="text-primary">FI</span>
            </span>
            <span className="text-sm">&#127467;&#127470;</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-2 pt-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const tabKey = item.href === "/" ? "dashboard" : item.href.slice(1);

          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href, tabKey)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                sidebarCollapsed && "justify-center px-0"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3 h-px bg-border/50" />

      {/* Wallet Manager + Scan button */}
      <div className="flex-1 overflow-y-auto px-3">
        <WalletManager collapsed={sidebarCollapsed} />

        {/* Scan button under wallets */}
        {hasEnabledWallets && !sidebarCollapsed && (
          <div className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => run()}
              disabled={loading}
            >
              {loading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <ScanSearchIcon className="size-3.5" />
              )}
              {loading ? "Scanning..." : "Scan Wallets"}
            </Button>
          </div>
        )}
        {hasEnabledWallets && sidebarCollapsed && (
          <div className="mt-2 flex justify-center">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => run()}
              disabled={loading}
              title={loading ? "Scanning..." : "Scan Wallets"}
            >
              {loading ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <ScanSearchIcon className="size-3.5" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 my-3 h-px bg-border/50" />

      {/* Tax Year Selector */}
      <div className={cn("px-3", sidebarCollapsed && "px-1.5")}>
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <span className="text-[10px] text-muted-foreground">Year</span>
            <span className="text-xs font-medium text-foreground">{taxYear}</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tax Year
            </p>
            <Select
              value={String(taxYear)}
              onValueChange={(val) => setTaxYear(Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Import Data */}
      <div className={cn("px-3 py-3", sidebarCollapsed && "px-2")}>
        {sidebarCollapsed ? (
          <Button
            variant="outline"
            size="icon"
            className="w-full"
            title="Import Data"
            onClick={() => onImportClick?.()}
          >
            <UploadIcon className="size-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onImportClick?.()}
          >
            <UploadIcon className="size-4" />
            Import Data
          </Button>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-border/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn("w-full gap-2", sidebarCollapsed && "justify-center")}
        >
          {sidebarCollapsed ? (
            <ChevronsRightIcon className="size-4" />
          ) : (
            <>
              <ChevronsLeftIcon className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>

    </aside>
  );
}
