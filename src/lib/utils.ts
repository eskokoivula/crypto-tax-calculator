import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatEurCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return formatEur(amount / 1_000_000).replace('€', '€') + 'M';
  }
  if (Math.abs(amount) >= 1_000) {
    return formatEur(amount / 1_000).replace('€', '€') + 'K';
  }
  return formatEur(amount);
}

export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function weiToEth(wei: string | bigint): number {
  const value = typeof wei === 'string' ? BigInt(wei) : wei;
  return Number(value) / 1e18;
}

export function parseMoralisBalance(balance: string, decimals: number | string): number {
  const dec = typeof decimals === 'string' ? parseInt(decimals, 10) : decimals;
  return Number(BigInt(balance)) / Math.pow(10, dec);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fi-FI', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('fi-FI', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function isValidEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function isValidWalletAddress(address: string): 'evm' | 'solana' | null {
  if (isValidEthAddress(address)) return 'evm';
  if (isValidSolanaAddress(address)) return 'solana';
  return null;
}

export function splitEurCents(amount: number): { eur: string; cents: string } {
  const abs = Math.abs(amount);
  const eur = Math.floor(abs).toString();
  const cents = Math.round((abs - Math.floor(abs)) * 100).toString().padStart(2, '0');
  return { eur, cents };
}

export function dateToFinnishFormat(date: Date): string {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear().toString();
  return `${dd}${mm}${yyyy}`;
}

export function getTaxYearRange(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
  };
}
