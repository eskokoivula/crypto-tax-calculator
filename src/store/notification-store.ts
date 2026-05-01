import { create } from 'zustand';
import type { Warning } from '@/types';
import { generateId } from '@/lib/utils';

interface NotificationState {
  warnings: Warning[];
}

interface NotificationActions {
  addWarning: (warning: Omit<Warning, 'id'>) => void;
  dismissWarning: (id: string) => void;
  clearWarnings: () => void;
  getActiveWarnings: () => Warning[];
  getWarningsByTransaction: (txId: string) => Warning[];
}

type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  warnings: [],

  addWarning(warning: Omit<Warning, 'id'>) {
    const newWarning: Warning = {
      ...warning,
      id: generateId(),
    };
    set((state) => ({ warnings: [...state.warnings, newWarning] }));
  },

  dismissWarning(id: string) {
    set((state) => ({
      warnings: state.warnings.map((w) =>
        w.id === id ? { ...w, dismissed: true } : w,
      ),
    }));
  },

  clearWarnings() {
    set({ warnings: [] });
  },

  getActiveWarnings() {
    return get().warnings.filter((w) => !w.dismissed);
  },

  getWarningsByTransaction(txId: string) {
    return get().warnings.filter((w) => w.transactionId === txId);
  },
}));
