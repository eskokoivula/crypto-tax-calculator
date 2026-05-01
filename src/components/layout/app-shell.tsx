"use client";

import { useState } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { ImportModal } from "@/components/exchange/import-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      {/* Main layout */}
      <div className="flex h-screen overflow-hidden">
        <Sidebar onImportClick={() => setImportOpen(true)} />
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-6">{children}</div>
        </main>
      </div>

      {/* Portaled overlays — rendered outside the flex container */}
      <ChatDrawer />
      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
      <Toaster richColors position="bottom-right" theme="dark" />
    </>
  );
}
