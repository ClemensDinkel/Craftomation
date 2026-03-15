// Shared market constants — single source of truth for price calculations
// Used by gameLoop.ts, auctionHandler.ts, and initialCalculations.ts

export const RESOURCE_REFERENCE_SUPPLY = 100;
export const CONSUMABLE_REFERENCE_SUPPLY = 10;
export const PRODUCTION_GOOD_REFERENCE_SUPPLY = 5;

export const RESOURCE_BASE_PRICE = 5;

export const BASE_PRICES: Record<number, number> = {
  1: 12,
  2: 20,
  3: 32,
  4: 50,
};

export const PRODUCTION_GOOD_BASE_PRICES: Record<number, number> = {
  1: 15,
  2: 30,
  3: 60,
  4: 120,
};
