"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/lib/ai/types";

interface ChatMessagesProps {
  messages: ChatMessage[];
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="sr-only">Typing</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
          style={{
            animation: "typing-dot 1.4s infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes typing-dot {
          0%,
          60%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-4xl">📖</div>
        <h3 className="text-sm font-medium text-foreground">
          No messages yet
        </h3>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Ask questions about your tax report or request modifications using the
          prompts below.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1 max-w-[85%]",
              msg.role === "user" ? "self-end items-end" : "self-start items-start"
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border text-card-foreground rounded-bl-md"
              )}
            >
              {msg.loading ? (
                <TypingIndicator />
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-1">
              {msg.modification && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {msg.modification.type}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground/60">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
