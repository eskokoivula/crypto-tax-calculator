import { create } from 'zustand';
import type {
  ReportModification,
  TaxCategory,
  TaxSummary,
  TokenBalance,
  Transaction,
  TransactionFilter,
} from '@/types';
import { FINNISH_TAX } from '@/types';
import { generateId } from '@/lib/utils';

interface TransactionProgress {
  currentWallet: string;
  currentChain: string;
  status: string;
}

interface TransactionState {
  transactions: Transaction[];
  balances: TokenBalance[];
  modifications: ReportModification[];
  loading: boolean;
  progress: TransactionProgress | null;
}

interface TransactionActions {
  setTransactions: (txs: Transaction[]) => void;
  setBalances: (balances: TokenBalance[]) => void;
  addTransactions: (txs: Transaction[]) => void;
  addModification: (mod: ReportModification) => void;
  toggleModification: (id: string) => void;
  removeModification: (id: string) => void;
  clearModifications: () => void;
  setLoading: (loading: boolean) => void;
  setProgress: (progress: TransactionProgress | null) => void;
  getFilteredTransactions: () => Transaction[];
  getTaxSummary: () => TaxSummary;
}

type TransactionStore = TransactionState & TransactionActions;

// ---------------------------------------------------------------------------
// Filter evaluation
// ---------------------------------------------------------------------------

function evaluateFilter(tx: Transaction, filter: TransactionFilter): boolean {
  const fieldValue = tx[filter.field as keyof Transaction];

  switch (filter.operator) {
    case 'equals':
      return fieldValue === filter.value;
    case 'not_equals':
      return fieldValue !== filter.value;
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(String(filter.value));
    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > Number(filter.value);
    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < Number(filter.value);
    case 'in':
      return Array.isArray(filter.value) && filter.value.includes(String(fieldValue));
    case 'not_in':
      return Array.isArray(filter.value) && !filter.value.includes(String(fieldValue));
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTransactionStore = create<TransactionStore>()((set, get) => ({
  transactions: [],
  balances: [],
  modifications: [],
  loading: false,
  progress: null,

  setTransactions(txs: Transaction[]) {
    set({ transactions: txs });
  },

  setBalances(balances: TokenBalance[]) {
    set({ balances });
  },

  addTransactions(txs: Transaction[]) {
    set((state) => {
      const existingIds = new Set(state.transactions.map((t) => t.id));
      const newTxs = txs.filter((t) => !existingIds.has(t.id));
      return { transactions: [...state.transactions, ...newTxs] };
    });
  },

  addModification(mod: ReportModification) {
    set((state) => ({
      modifications: [...state.modifications, { ...mod, id: mod.id || generateId() }],
    }));
  },

  toggleModification(id: string) {
    set((state) => ({
      modifications: state.modifications.map((m) =>
        m.id === id ? { ...m, active: !m.active } : m,
      ),
    }));
  },

  removeModification(id: string) {
    set((state) => ({
      modifications: state.modifications.filter((m) => m.id !== id),
    }));
  },

  clearModifications() {
    set({ modifications: [] });
  },

  setLoading(loading: boolean) {
    set({ loading });
  },

  setProgress(progress: TransactionProgress | null) {
    set({ progress });
  },

  getFilteredTransactions(): Transaction[] {
    const { transactions, modifications } = get();
    const activeMods = modifications.filter((m) => m.active);

    if (activeMods.length === 0) return transactions;

    let result = [...transactions];

    // Build a map for recategorizations (txId -> newCategory)
    const recategorizationMap = new Map<string, TaxCategory>();

    // Collect all excluded tx IDs
    const excludedIds = new Set<string>();

    for (const mod of activeMods) {
      switch (mod.type) {
        case 'filter':
          if (mod.filter) {
            result = result.filter((tx) => evaluateFilter(tx, mod.filter!));
          }
          break;

        case 'exclude':
          if (mod.excludedTxIds) {
            for (const id of mod.excludedTxIds) {
              excludedIds.add(id);
            }
          }
          break;

        case 'recategorize':
          if (mod.recategorizations) {
            for (const r of mod.recategorizations) {
              recategorizationMap.set(r.txId, r.newCategory);
            }
          }
          break;

        case 'custom':
          // Custom modifications are applied externally
          break;
      }
    }

    // Apply exclusions
    if (excludedIds.size > 0) {
      result = result.filter((tx) => !excludedIds.has(tx.id));
    }

    // Apply recategorizations
    if (recategorizationMap.size > 0) {
      result = result.map((tx) => {
        const newCategory = recategorizationMap.get(tx.id);
        if (newCategory) {
          return { ...tx, categoryOverride: newCategory };
        }
        return tx;
      });
    }

    return result;
  },

  getTaxSummary(): TaxSummary {
    const txs = get().getFilteredTransactions();

    let totalRealizedGainsEur = 0;
    let totalUnrealizedGainsEur = 0;
    let totalIncomeEur = 0;
    let totalFeesEur = 0;
    let disposalCount = 0;
    let incomeCount = 0;
    let transferCount = 0;
    let purchaseCount = 0;
    let issueCount = 0;

    for (const tx of txs) {
      const effectiveCategory = tx.categoryOverride ?? tx.category;
      const fees = (tx.gasFeeEur || 0) + (tx.exchangeFeeEur || 0);
      totalFeesEur += fees;

      switch (effectiveCategory) {
        case 'disposal':
          disposalCount++;
          if (tx.gainLossEur != null && tx.gainLossEur > 0) {
            totalRealizedGainsEur += tx.gainLossEur;
          } else if (tx.gainLossEur != null) {
            totalRealizedGainsEur += tx.gainLossEur; // Losses are negative
          }
          break;
        case 'income':
          incomeCount++;
          totalIncomeEur += tx.valueEur || 0;
          break;
        case 'transfer':
          transferCount++;
          break;
        case 'purchase':
          purchaseCount++;
          break;
      }

      if (tx.warnings.length > 0) {
        issueCount++;
      }
    }

    // Taxable gains = realized gains + income
    const taxableGainsEur = totalRealizedGainsEur + totalIncomeEur;

    // Finnish capital gains tax: 30% up to 30k, 34% above
    let estimatedTaxEur = 0;
    if (taxableGainsEur > 0) {
      const { CAPITAL_GAINS_RATE_LOW, CAPITAL_GAINS_RATE_HIGH, CAPITAL_GAINS_THRESHOLD } =
        FINNISH_TAX;
      if (taxableGainsEur <= CAPITAL_GAINS_THRESHOLD) {
        estimatedTaxEur = taxableGainsEur * CAPITAL_GAINS_RATE_LOW;
      } else {
        estimatedTaxEur =
          CAPITAL_GAINS_THRESHOLD * CAPITAL_GAINS_RATE_LOW +
          (taxableGainsEur - CAPITAL_GAINS_THRESHOLD) * CAPITAL_GAINS_RATE_HIGH;
      }
    }

    const netPositionEur = totalRealizedGainsEur + totalIncomeEur - totalFeesEur;

    return {
      totalRealizedGainsEur,
      totalUnrealizedGainsEur,
      totalIncomeEur,
      totalFeesEur,
      netPositionEur,
      taxableGainsEur,
      estimatedTaxEur,
      disposalCount,
      incomeCount,
      transferCount,
      purchaseCount,
      issueCount,
    };
  },
}));
