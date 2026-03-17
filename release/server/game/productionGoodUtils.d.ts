import { Player, ProductionGoodBonusType } from '@craftomation/shared';
/**
 * Get the active bonus value for a given bonus type.
 * Returns the highest bonusValue among all active (isUsed) items of that type.
 */
export declare function getActiveBonus(player: Player, bonusType: ProductionGoodBonusType): number;
/**
 * Get the active item ID for a given bonus type (for special effects like nano_forge).
 */
export declare function getActiveBonusItemId(player: Player, bonusType: ProductionGoodBonusType): string | null;
/**
 * Activate a production good for a player.
 * If no stronger item of the same bonus type is active, mark it as used (starts wear).
 * Otherwise keep it as reserve.
 */
export declare function activateProductionGood(player: Player, itemId: string): void;
/**
 * Apply one unit of wear for a given bonus type.
 * Called when the bonus is actually used (mining tick, craft completion, lab experiment, etc.).
 * Removes expired items and auto-activates replacements.
 */
export declare function applyWear(player: Player, bonusType: ProductionGoodBonusType): void;
export declare function getDefinition(itemId: string): import("@craftomation/shared").ProductionGoodDefinition | undefined;
