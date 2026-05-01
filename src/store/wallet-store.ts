"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainId, Wallet, WalletType } from "@/types";
import { WALLET_COLORS } from "@/types";
import { isValidWalletAddress } from "@/lib/utils";

const MAX_WALLETS = 10;

interface PersistedWalletState {
  wallets: Pick<Wallet, "address" | "label" | "color" | "type">[];
  taxYear: number;
}

interface WalletStore {
  wallets: Wallet[];
  taxYear: number;
  addWallet: (address: string, label?: string) => boolean;
  removeWallet: (address: string) => void;
  toggleWallet: (address: string) => void;
  updateWallet: (address: string, updates: Partial<Wallet>) => void;
  setTaxYear: (year: number) => void;
}

function getNextColor(wallets: Wallet[]): string {
  const usedColors = new Set(wallets.map((w) => w.color));
  return (
    WALLET_COLORS.find((c) => !usedColors.has(c)) ??
    WALLET_COLORS[wallets.length % WALLET_COLORS.length]
  );
}

function normalizeAddress(address: string, type: WalletType): string {
  return type === 'evm' ? address.toLowerCase() : address;
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      wallets: [],
      taxYear: 2025,

      addWallet: (address: string, label?: string): boolean => {
        const { wallets } = get();
        if (wallets.length >= MAX_WALLETS) return false;

        const walletType = isValidWalletAddress(address.trim());
        if (!walletType) return false;

        const normalized = normalizeAddress(address.trim(), walletType);
        if (wallets.some((w) => w.address === normalized)) return false;

        const color = getNextColor(wallets);
        const newWallet: Wallet = {
          address: normalized,
          label: label || (walletType === 'solana' ? 'Solana Wallet' : ''),
          color,
          enabled: true,
          detectedChains: walletType === 'solana' ? ['solana'] : [],
          loading: true,
          type: walletType,
        };

        set({ wallets: [...wallets, newWallet] });
        return true;
      },

      removeWallet: (address: string) => {
        set({
          wallets: get().wallets.filter((w) => w.address !== address),
        });
      },

      toggleWallet: (address: string) => {
        set({
          wallets: get().wallets.map((w) =>
            w.address === address ? { ...w, enabled: !w.enabled } : w
          ),
        });
      },

      updateWallet: (address: string, updates: Partial<Wallet>) => {
        set({
          wallets: get().wallets.map((w) =>
            w.address === address ? { ...w, ...updates } : w
          ),
        });
      },

      setTaxYear: (year: number) => {
        set({ taxYear: year });
      },
    }),
    {
      name: "cryptotax-wallets",
      partialize: (state): PersistedWalletState => ({
        wallets: state.wallets.map((w) => ({
          address: w.address,
          label: w.label,
          color: w.color,
          type: w.type,
        })),
        taxYear: state.taxYear,
      }),
      merge: (persisted, current) => {
        const saved = persisted as PersistedWalletState | undefined;
        if (!saved) return current;

        return {
          ...current,
          taxYear: saved.taxYear ?? current.taxYear,
          wallets: (saved.wallets ?? []).map((w) => ({
            address: w.address,
            label: w.label,
            color: w.color,
            type: w.type ?? 'evm' as WalletType,
            enabled: true,
            detectedChains: (w.type === 'solana' ? ['solana'] : []) as ChainId[],
            loading: true,
          })),
        };
      },
    }
  )
);
