"use strict";
// Shared market constants — single source of truth for price calculations
// Used by gameLoop.ts, auctionHandler.ts, and initialCalculations.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCTION_GOOD_BASE_PRICES = exports.BASE_PRICES = exports.RESOURCE_BASE_PRICE = exports.MAX_PRICE_MULTIPLIER = exports.PRODUCTION_GOOD_REFERENCE_SUPPLY = exports.CONSUMABLE_REFERENCE_SUPPLY = exports.RESOURCE_REFERENCE_SUPPLY = void 0;
exports.RESOURCE_REFERENCE_SUPPLY = 100;
exports.CONSUMABLE_REFERENCE_SUPPLY = 20;
exports.PRODUCTION_GOOD_REFERENCE_SUPPLY = 20;
// Max price multiplier for exponential decay formula (at supply=0: basePrice * MAX_PRICE_MULTIPLIER)
exports.MAX_PRICE_MULTIPLIER = 5;
exports.RESOURCE_BASE_PRICE = 5;
exports.BASE_PRICES = {
    1: 12,
    2: 20,
    3: 32,
    4: 50,
};
exports.PRODUCTION_GOOD_BASE_PRICES = {
    1: 15,
    2: 30,
    3: 60,
    4: 120,
};
//# sourceMappingURL=marketConstants.js.map