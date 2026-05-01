"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveTab = "dashboard" | "transactions" | "holdings" | "reports";

const DEFAULT_COLUMNS: Record<string, boolean> = {
  date: true,
  chain: true,
  token: true,
  amount: true,
  valueEur: true,
  category: true,
  gasFee: true,
  gainLoss: true,
  wallet: true,
  source: true,
  warnings: true,
};

interface UiStore {
  sidebarCollapsed: boolean;
  chatOpen: boolean;
  columnVisibility: Record<string, boolean>;
  activeTab: ActiveTab;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setColumnVisibility: (column: string, visible: boolean) => void;
  toggleColumnVisibility: (column: string) => void;
  resetColumnVisibility: () => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      chatOpen: false,
      columnVisibility: { ...DEFAULT_COLUMNS },
      activeTab: "dashboard",

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed: boolean) => {
        set({ sidebarCollapsed: collapsed });
      },

      toggleChat: () => {
        set((state) => ({ chatOpen: !state.chatOpen }));
      },

      setChatOpen: (open: boolean) => {
        set({ chatOpen: open });
      },

      setColumnVisibility: (column: string, visible: boolean) => {
        set((state) => ({
          columnVisibility: { ...state.columnVisibility, [column]: visible },
        }));
      },

      toggleColumnVisibility: (column: string) => {
        set((state) => ({
          columnVisibility: {
            ...state.columnVisibility,
            [column]: !state.columnVisibility[column],
          },
        }));
      },

      resetColumnVisibility: () => {
        set({ columnVisibility: { ...DEFAULT_COLUMNS } });
      },

      setActiveTab: (tab: ActiveTab) => {
        set({ activeTab: tab });
      },
    }),
    {
      name: "cryptotax-ui",
    }
  )
);
