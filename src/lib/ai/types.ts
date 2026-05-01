import type { ReportModification } from '@/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modification?: ReportModification;
  timestamp: Date;
  loading?: boolean;
}

export interface ChatContext {
  totalTransactions: number;
  categoryCounts: Record<string, number>;
  topTokens: string[];
  totalGainsEur: number;
  totalIncomeEur: number;
  taxYear: number;
  walletCount: number;
}

export interface AiModificationResponse {
  message: string;
  modification?: {
    type: 'filter' | 'recategorize' | 'exclude' | 'custom';
    description: string;
    filter?: {
      field: string;
      operator: string;
      value: string | number | string[];
    };
    excludeTokens?: string[];
    excludeTxIds?: string[];
    recategorizations?: { txId: string; newCategory: string }[];
  };
}
