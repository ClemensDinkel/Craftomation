export declare function handleAddManufacturingJob(payload: {
    playerId: string;
    recipeId: string;
    repeat: boolean;
    autoBuy?: boolean;
}): void;
export declare function handleRemoveManufacturingJob(payload: {
    playerId: string;
    jobIndex: number;
}): void;
export declare function handleSetManufacturingAutoBuy(payload: {
    playerId: string;
    autoBuy: boolean;
}): void;
export declare function handleDebugUnlockRecipe(payload: {
    playerId: string;
    recipeId: string;
}): void;
