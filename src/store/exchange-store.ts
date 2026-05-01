import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExchangeApiConnection, ExchangeImport, ExchangeSource } from '@/types';

interface ExchangeState {
  imports: ExchangeImport[];
  apiConnections: ExchangeApiConnection[];
}

interface ExchangeActions {
  addImport: (imp: ExchangeImport) => void;
  removeImport: (id: string) => void;
  toggleImport: (id: string) => void;
  setApiConnection: (exchange: ExchangeSource, connected: boolean, error?: string) => void;
}

type ExchangeStore = ExchangeState & ExchangeActions;

export const useExchangeStore = create<ExchangeStore>()(
  persist(
    (set) => ({
      imports: [],
      apiConnections: [],

      addImport(imp: ExchangeImport) {
        set((state) => ({
          imports: [...state.imports, imp],
        }));
      },

      removeImport(id: string) {
        set((state) => ({
          imports: state.imports.filter((i) => i.id !== id),
        }));
      },

      toggleImport(id: string) {
        set((state) => ({
          imports: state.imports.map((i) =>
            i.id === id ? { ...i, enabled: !i.enabled } : i,
          ),
        }));
      },

      setApiConnection(exchange: ExchangeSource, connected: boolean, error?: string) {
        set((state) => {
          const existing = state.apiConnections.findIndex((c) => c.exchange === exchange);
          const connection: ExchangeApiConnection = {
            exchange,
            connected,
            lastSync: connected ? new Date() : state.apiConnections[existing]?.lastSync,
            error,
          };

          if (existing >= 0) {
            const updated = [...state.apiConnections];
            updated[existing] = connection;
            return { apiConnections: updated };
          }

          return { apiConnections: [...state.apiConnections, connection] };
        });
      },
    }),
    {
      name: 'moralis-tax-exchanges',
      partialize: (state) => ({
        imports: state.imports,
        apiConnections: state.apiConnections,
      }),
    },
  ),
);
