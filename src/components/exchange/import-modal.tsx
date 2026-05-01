"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CsvPreview } from "./csv-preview";
import { ApiConnectForm } from "./api-connect-form";
import { ExchangeInstructions } from "./exchange-instructions";
import { useExchangeStore } from "@/store/exchange-store";
import {
  EXCHANGE_INSTRUCTIONS,
  SUPPORTED_EXCHANGES,
} from "@/lib/exchange/instructions";
import { binanceParser } from "@/lib/exchange/parsers/binance";
import { cryptoComParser } from "@/lib/exchange/parsers/cryptocom";
import { revolutParser } from "@/lib/exchange/parsers/revolut";
import { bybitParser } from "@/lib/exchange/parsers/bybit";
import type { ParsedTransaction } from "@/lib/exchange/types";
import type { ExchangeImport, ExchangeSource, Transaction } from "@/types";
import { cn, generateId } from "@/lib/utils";
import {
  UploadIcon,
  FileTextIcon,
  KeyIcon,
  BookOpenIcon,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";

const PARSERS: Record<string, (csv: string) => ParsedTransaction[]> = {
  binance: (csv) => binanceParser.parse(csv),
  "crypto.com": (csv) => cryptoComParser.parse(csv),
  revolut: (csv) => revolutParser.parse(csv),
  bybit: (csv) => bybitParser.parse(csv),
};

function parsedToTransactions(
  parsed: ParsedTransaction[],
  source: ExchangeSource
): Transaction[] {
  return parsed.map((p, index) => ({
    id: generateId() + "-" + index,
    txHash: "",
    blockNumber: 0,
    timestamp: p.date.toISOString(),
    date: p.date,
    chain: "0x1" as const,
    walletAddress: "",
    from: "",
    to: "",
    tokenName: p.tokenSymbol,
    tokenSymbol: p.tokenSymbol,
    tokenAddress: "",
    amount: p.amount.toString(),
    amountFormatted: p.amount,
    valueUsd: p.priceUsd ? p.amount * p.priceUsd : 0,
    valueEur: p.priceEur ? p.amount * p.priceEur : 0,
    gasFeeEur: 0,
    exchangeFeeEur: 0,
    category: mapTypeToCategory(p.type),
    source,
    warnings: [],
    isInternalTransfer: false,
    dismissed: false,
  }));
}

function mapTypeToCategory(
  type: ParsedTransaction["type"]
): Transaction["category"] {
  switch (type) {
    case "buy":
      return "purchase";
    case "sell":
    case "trade":
      return "disposal";
    case "deposit":
    case "withdrawal":
      return "transfer";
    case "staking_reward":
    case "airdrop":
      return "income";
    case "fee":
      return "disposal";
    default:
      return "transfer";
  }
}

type TabValue = "csv" | "api" | "instructions";

interface ImportModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("csv");
  const [selectedExchange, setSelectedExchange] = useState<string>("binance");
  const [parsedTransactions, setParsedTransactions] =
    useState<ParsedTransaction[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [instructionMode, setInstructionMode] = useState<"csv" | "api">("csv");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImport = useExchangeStore((s) => s.addImport);
  const setApiConnection = useExchangeStore((s) => s.setApiConnection);

  const handleFileRead = useCallback(
    (file: File) => {
      setParsing(true);
      setFileError(null);
      setParseErrors([]);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvContent = e.target?.result as string;
          if (!csvContent || csvContent.trim().length === 0) {
            setFileError("File is empty.");
            setParsing(false);
            return;
          }

          const parser = PARSERS[selectedExchange];
          if (!parser) {
            setFileError("No parser for this exchange. Try generic CSV.");
            setParsing(false);
            return;
          }

          const transactions = parser(csvContent);
          if (transactions.length === 0) {
            setFileError("No transactions found. Check the exchange format.");
            setParsing(false);
            return;
          }

          const warnings: string[] = [];
          const otherCount = transactions.filter(
            (t) => t.type === "other"
          ).length;
          if (otherCount > 0) warnings.push(`${otherCount} unknown types.`);

          setParsedTransactions(transactions);
          setParseErrors(warnings);
        } catch (err) {
          setFileError(
            err instanceof Error ? err.message : "Failed to parse CSV."
          );
        }
        setParsing(false);
      };
      reader.onerror = () => {
        setFileError("Failed to read file.");
        setParsing(false);
      };
      reader.readAsText(file);
    },
    [selectedExchange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileRead(file);
    },
    [handleFileRead]
  );

  const handleConfirmImport = useCallback(() => {
    if (!parsedTransactions) return;
    const source = selectedExchange as ExchangeSource;
    const transactions = parsedToTransactions(parsedTransactions, source);
    const imp: ExchangeImport = {
      id: generateId(),
      fileName: `${selectedExchange}-import.csv`,
      source,
      transactions,
      importedAt: new Date(),
      enabled: true,
    };
    addImport(imp);
    setParsedTransactions(null);
    onOpenChange?.(false);
  }, [parsedTransactions, selectedExchange, addImport, onOpenChange]);

  const handleApiConnect = useCallback(
    async (apiKey: string, secret: string) => {
      const exchangeKey =
        selectedExchange === "crypto.com" ? "cryptocom" : selectedExchange;
      try {
        const res = await fetch(`/api/exchange/${exchangeKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, secret, action: "trades" }),
        });
        const data = await res.json();
        if (data.transactions?.length > 0) {
          const source = selectedExchange as ExchangeSource;
          const transactions = parsedToTransactions(
            data.transactions.map(
              (t: ParsedTransaction & { date: string }) => ({
                ...t,
                date: new Date(t.date),
              })
            ),
            source
          );
          addImport({
            id: generateId(),
            fileName: `${selectedExchange}-api-sync`,
            source,
            transactions,
            importedAt: new Date(),
            enabled: true,
          });
          setApiConnection(source, true);
        }
        onOpenChange?.(false);
      } catch (err) {
        setApiConnection(
          selectedExchange as ExchangeSource,
          false,
          err instanceof Error ? err.message : "Failed"
        );
      }
    },
    [selectedExchange, addImport, setApiConnection, onOpenChange]
  );

  const tabs: { value: TabValue; label: string; icon: React.ReactNode }[] = [
    { value: "csv", label: "Upload CSV", icon: <FileTextIcon className="size-3.5" /> },
    { value: "api", label: "Connect API", icon: <KeyIcon className="size-3.5" /> },
    { value: "instructions", label: "Guide", icon: <BookOpenIcon className="size-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import Exchange Data</DialogTitle>
          <DialogDescription>
            Upload CSV or connect via API to import transactions.
          </DialogDescription>
        </DialogHeader>

        {/* Exchange selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground shrink-0">
            Exchange
          </label>
          <Select
            value={selectedExchange}
            onValueChange={(val) => {
              if (val) setSelectedExchange(val);
              setParsedTransactions(null);
              setFileError(null);
            }}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_EXCHANGES.map((key) => {
                const inst = EXCHANGE_INSTRUCTIONS[key];
                return (
                  <SelectItem key={key} value={key}>
                    {inst?.logo} {inst?.exchange || key}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* CSV Tab */}
          {activeTab === "csv" && (
            <div className="space-y-4">
              {parsedTransactions ? (
                <CsvPreview
                  transactions={parsedTransactions}
                  errors={parseErrors}
                  onConfirm={handleConfirmImport}
                  onCancel={() => {
                    setParsedTransactions(null);
                    setFileError(null);
                  }}
                />
              ) : (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    {parsing ? (
                      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                    ) : (
                      <UploadIcon className="size-8 text-muted-foreground" />
                    )}
                    <p className="text-sm font-medium">
                      {parsing ? "Parsing..." : "Drop CSV file here"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      or click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileRead(file);
                      }}
                    />
                  </div>
                  {fileError && (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
                      {fileError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* API Tab */}
          {activeTab === "api" && (
            <div>
              {selectedExchange === "revolut" ? (
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Revolut does not offer a crypto API.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please use CSV export instead.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setActiveTab("csv")}
                  >
                    Go to CSV Upload
                  </Button>
                </div>
              ) : (
                <ApiConnectForm
                  exchange={
                    selectedExchange === "crypto.com"
                      ? "cryptocom"
                      : selectedExchange
                  }
                  onConnect={handleApiConnect}
                />
              )}
            </div>
          )}

          {/* Instructions Tab */}
          {activeTab === "instructions" && (
            <div className="space-y-3">
              <div className="flex gap-1 rounded-md bg-muted/50 p-0.5">
                <button
                  onClick={() => setInstructionMode("csv")}
                  className={cn(
                    "flex-1 rounded px-3 py-1 text-xs font-medium transition-colors",
                    instructionMode === "csv"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  CSV Export
                </button>
                <button
                  onClick={() => setInstructionMode("api")}
                  className={cn(
                    "flex-1 rounded px-3 py-1 text-xs font-medium transition-colors",
                    instructionMode === "api"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  API Setup
                </button>
              </div>
              <ExchangeInstructions
                exchange={selectedExchange}
                mode={instructionMode}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
