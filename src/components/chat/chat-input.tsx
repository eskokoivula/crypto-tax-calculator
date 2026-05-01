"use client";

import { useState, useRef, useCallback } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  loading: boolean;
}

const EXAMPLE_PROMPTS = [
  "Remove all USDC transactions",
  "Show only disposals above 1000\u20AC",
  "What\u2019s my total tax liability?",
  "Recategorize airdrops as income",
];

export function ChatInput({ onSend, loading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, loading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    const maxHeight = 4 * 24; // ~4 lines
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  };

  const isEmpty = value.trim().length === 0;

  return (
    <div className="border-t border-border p-3 space-y-2.5">
      {/* Example prompts when empty */}
      {isEmpty && !loading && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt)}
              className={cn(
                "rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px]",
                "text-muted-foreground hover:text-foreground hover:border-primary/40",
                "hover:bg-primary/5 transition-colors cursor-pointer"
              )}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Ask about your taxes or modify the report..."
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-border bg-card/30 px-3 py-2.5",
            "text-sm text-foreground placeholder:text-muted-foreground/50",
            "focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
          style={{ height: "auto", minHeight: "40px" }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isEmpty || loading}
          className={cn(
            "h-10 w-10 shrink-0 rounded-xl",
            !isEmpty && !loading && "bg-primary hover:bg-primary/90"
          )}
        >
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
