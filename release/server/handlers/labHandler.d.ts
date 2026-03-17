import { type LabResult } from '@craftomation/shared';
export declare function handleSetLabAutoBuy(payload: {
    playerId: string;
    autoBuy: boolean;
}): void;
export declare function handleLabExperiment(clientId: string, payload: {
    playerId: string;
    sequence: string[];
}): LabResult;
