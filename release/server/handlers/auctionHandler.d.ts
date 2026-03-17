import { type AutoTradeRule } from '@craftomation/shared';
export declare function handleMarketBuy(clientId: string, payload: {
    playerId: string;
    itemId: string;
    itemType: 'resource' | 'consumable' | 'production_good';
    amount: number;
}): void;
export declare function handleMarketSell(clientId: string, payload: {
    playerId: string;
    itemId: string;
    itemType: 'resource' | 'consumable' | 'production_good';
    amount: number;
}): void;
export declare function handleListRecipe(clientId: string, payload: {
    playerId: string;
    recipeId: string;
    price: number;
}): void;
export declare function handleBuyRecipe(clientId: string, payload: {
    buyerPlayerId: string;
    listingId: string;
}): void;
export declare function handleBuyMiningRight(clientId: string, payload: {
    playerId: string;
    resourceId: string;
}): void;
export declare function handleSetAutoTradeRule(clientId: string, payload: {
    playerId: string;
    rule: Omit<AutoTradeRule, 'id'> & {
        id?: string;
    };
}): void;
export declare function handleRemoveAutoTradeRule(clientId: string, payload: {
    playerId: string;
    ruleId: string;
}): void;
export declare function handleDebugSetInventory(payload: {
    playerId: string;
    itemId: string;
    itemType: 'resource' | 'consumable' | 'production_good' | 'cash';
    amount: number;
}): void;
