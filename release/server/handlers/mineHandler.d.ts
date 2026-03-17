export declare function handleAddPlayer(payload: {
    playerName: string;
}): void;
export declare function handleBoostMinePlayer(payload: {
    playerId: string;
}): void;
export declare function handleChangeMineResource(payload: {
    playerId: string;
    resourceIds: string[];
}): void;
