"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function handleChange(next: string) {
    setLocal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(next);
    }, 300);
  }

  function handleClear() {
    setLocal("");
    onChange("");
  }

  return (
    <div className="relative w-full max-w-sm">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search token, address, hash..."
        className="pl-8 pr-8"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
      />
      {local && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
