export type CsvFormat = 'generic' | 'koinly' | 'turbotax' | 'omavero';

export interface Lomake9Data {
  name: string;
  henkilotunnus: string;
  taxYear: number;
  cryptoNames: string; // e.g., "BTC, ETH"
  disposalDate: Date;
  acquisitionDate: Date;
  salePriceEur: number;
  acquisitionCostEur: number;
  acquisitionExpensesEur: number; // gas + exchange fees
  deemedCostEur: number; // hankintameno-olettama
  gainEur: number;
  lossEur: number;
  useDeemedCost: boolean;
}

export interface UserInfo {
  name: string;
  henkilotunnus: string;
}
