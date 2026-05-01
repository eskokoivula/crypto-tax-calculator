"use client";

import { useCallback, useState } from "react";
import { Flame } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useUiStore } from "@/store/ui-store";
import { useTransactionStore } from "@/store/transaction-store";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { ModificationPills } from "./modification-pills";
import { parseAiResponse } from "@/lib/ai/chat";
import { cn, generateId } from "@/lib/utils";
import type { ChatMessage, ChatContext } from "@/lib/ai/types";
import type { ReportModification, TaxCategory } from "@/types";

export function ChatDrawer() {
  const { chatOpen, setChatOpen } = useUiStore();
  const {
    transactions,
    modifications,
    addModification,
    toggleModification,
    removeModification,
    clearModifications,
  } = useTransactionStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const buildContext = useCallback((): ChatContext => {
    const categoryCounts: Record<string, number> = {};
    const tokenCounts: Record<string, number> = {};
    let totalGainsEur = 0;
    let totalIncomeEur = 0;

    for (const tx of transactions) {
      const cat = tx.categoryOverride ?? tx.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      tokenCounts[tx.tokenSymbol] = (tokenCounts[tx.tokenSymbol] || 0) + 1;

      if (cat === "disposal" && tx.gainLossEur != null) {
        totalGainsEur += tx.gainLossEur;
      }
      if (cat === "income") {
        totalIncomeEur += tx.valueEur || 0;
      }
    }

    const topTokens = Object.entries(tokenCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbol]) => symbol);

    return {
      totalTransactions: transactions.length,
      categoryCounts,
      topTokens,
      totalGainsEur,
      totalIncomeEur,
      taxYear: new Date().getFullYear() - 1,
      walletCount: new Set(transactions.map((tx) => tx.walletAddress)).size,
    };
  }, [transactions]);

  const handleSend = useCallback(
    async (message: string) => {
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);

      try {
        const context = buildContext();

        // Build history (last 10 messages for context window)
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, context, history }),
        });

        if (!response.ok) {
          throw new Error("Chat request failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fullText += decoder.decode(value, { stream: true });

          // Update the assistant message with streamed content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: fullText, loading: false }
                : m
            )
          );
        }

        // Parse for modifications
        const parsed = parseAiResponse(fullText);

        if (parsed.modification) {
          const mod: ReportModification = {
            id: generateId(),
            description: parsed.modification.description,
            type: parsed.modification.type,
            active: true,
            createdAt: new Date(),
          };

          if (parsed.modification.filter) {
            mod.filter = {
              field: parsed.modification.filter.field,
              operator: parsed.modification.filter.operator as ReportModification["filter"] extends undefined ? never : NonNullable<ReportModification["filter"]>["operator"],
              value: parsed.modification.filter.value,
            };
          }

          if (parsed.modification.excludeTxIds) {
            mod.excludedTxIds = parsed.modification.excludeTxIds;
          }

          if (parsed.modification.excludeTokens) {
            // Convert token exclusions to a filter-based modification
            mod.type = "filter";
            mod.filter = {
              field: "tokenSymbol",
              operator: "not_in",
              value: parsed.modification.excludeTokens,
            };
          }

          if (parsed.modification.recategorizations) {
            mod.recategorizations = parsed.modification.recategorizations.map(
              (r) => ({
                txId: r.txId,
                newCategory: r.newCategory as TaxCategory,
              })
            );
          }

          addModification(mod);

          // Update the message to include the modification reference
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: parsed.message, modification: mod }
                : m
            )
          );
        }
      } catch (error) {
        console.error("Chat error:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content:
                    "Sorry, something went wrong. Please check that your API key is configured and try again.",
                  loading: false,
                }
              : m
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [messages, buildContext, addModification]
  );

  const activeCount = modifications.filter((m) => m.active).length;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setChatOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex items-center gap-2",
          "rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground",
          "shadow-lg shadow-primary/25 hover:bg-primary/90",
          "transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]",
          "active:scale-[0.98] cursor-pointer"
        )}
      >
        <Flame className="h-4 w-4" />
        <span>Cook the Books</span>
        {activeCount > 0 && (
          <Badge
            variant="destructive"
            className="ml-0.5 h-5 min-w-[20px] px-1.5 text-[10px] font-semibold"
          >
            {activeCount}
          </Badge>
        )}
      </button>

      {/* Sheet drawer */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="right"
          className="w-[420px] sm:max-w-[420px] flex flex-col p-0 gap-0 bg-background"
        >
        {/* Header */}
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span>📖</span>
            <span>Cook the Books</span>
          </SheetTitle>
          <SheetDescription className="text-xs">
            Use Claude to ask questions or cook the books
          </SheetDescription>
        </SheetHeader>

        {/* Modification pills */}
        <ModificationPills
          modifications={modifications}
          onToggle={toggleModification}
          onRemove={removeModification}
          onClearAll={clearModifications}
        />

        {/* Messages */}
        <ChatMessages messages={messages} />

        {/* Input */}
        <ChatInput onSend={handleSend} loading={loading} />
        </SheetContent>
      </Sheet>
    </>
  );
}
