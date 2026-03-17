"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveBonus = getActiveBonus;
exports.getActiveBonusItemId = getActiveBonusItemId;
exports.activateProductionGood = activateProductionGood;
exports.applyWear = applyWear;
exports.getDefinition = getDefinition;
const productionGoods_1 = require("../data/productionGoods");
const defMap = new Map(productionGoods_1.PRODUCTION_GOOD_DEFINITIONS.map(d => [d.id, d]));
/**
 * Get the active bonus value for a given bonus type.
 * Returns the highest bonusValue among all active (isUsed) items of that type.
 */
function getActiveBonus(player, bonusType) {
    let best = 0;
    for (const [itemId, items] of Object.entries(player.productionGoods)) {
        const def = defMap.get(itemId);
        if (!def || def.bonusType !== bonusType)
            continue;
        for (const item of items) {
            if (item.isUsed && item.wearRemaining > 0 && def.bonusValue > best) {
                best = def.bonusValue;
            }
        }
    }
    return best;
}
/**
 * Get the active item ID for a given bonus type (for special effects like nano_forge).
 */
function getActiveBonusItemId(player, bonusType) {
    let bestValue = 0;
    let bestId = null;
    for (const [itemId, items] of Object.entries(player.productionGoods)) {
        const def = defMap.get(itemId);
        if (!def || def.bonusType !== bonusType)
            continue;
        for (const item of items) {
            if (item.isUsed && item.wearRemaining > 0 && def.bonusValue > bestValue) {
                bestValue = def.bonusValue;
                bestId = itemId;
            }
        }
    }
    return bestId;
}
/**
 * Activate a production good for a player.
 * If no stronger item of the same bonus type is active, mark it as used (starts wear).
 * Otherwise keep it as reserve.
 */
function activateProductionGood(player, itemId) {
    const def = defMap.get(itemId);
    if (!def)
        return;
    const items = player.productionGoods[itemId];
    if (!items || items.length === 0)
        return;
    // Find the newly added unused item (last one)
    const newItem = items[items.length - 1];
    // Check if a stronger item of the same bonus type is already active
    const currentBonus = getActiveBonus(player, def.bonusType);
    if (currentBonus >= def.bonusValue) {
        // Stronger or equal already active — keep as reserve
        return;
    }
    // Activate this item
    newItem.isUsed = true;
    // If a weaker item of the same bonus type was active, pause it (keep its wear as-is)
    // No need to do anything — getActiveBonus naturally picks the highest value
}
/**
 * Apply one unit of wear for a given bonus type.
 * Called when the bonus is actually used (mining tick, craft completion, lab experiment, etc.).
 * Removes expired items and auto-activates replacements.
 */
function applyWear(player, bonusType) {
    // Find the strongest active item of this bonus type
    let strongest = null;
    for (const [itemId, items] of Object.entries(player.productionGoods)) {
        const def = defMap.get(itemId);
        if (!def || def.bonusType !== bonusType)
            continue;
        for (const item of items) {
            if (!item.isUsed || item.wearRemaining <= 0)
                continue;
            if (!strongest || def.bonusValue > strongest.bonusValue) {
                strongest = { itemId, item, bonusValue: def.bonusValue };
            }
        }
    }
    if (!strongest)
        return;
    // Deduct 1 use
    strongest.item.wearRemaining -= 1;
    // If expired, remove and auto-activate replacement
    if (strongest.item.wearRemaining <= 0) {
        const items = player.productionGoods[strongest.itemId];
        if (items) {
            player.productionGoods[strongest.itemId] = items.filter(i => !(i.isUsed && i.wearRemaining <= 0));
            // Auto-activate: find an unused item of the same type
            const def = defMap.get(strongest.itemId);
            if (def) {
                const unused = player.productionGoods[strongest.itemId]?.find(i => !i.isUsed);
                if (unused) {
                    unused.isUsed = true;
                }
                else {
                    autoActivateFallback(player, bonusType);
                }
            }
            // Clean up empty arrays
            if (player.productionGoods[strongest.itemId]?.length === 0) {
                delete player.productionGoods[strongest.itemId];
            }
        }
    }
}
/**
 * When the strongest item of a bonus type expires, look for the next best unused item
 * of the same bonus type (possibly a different itemId) and activate it.
 */
function autoActivateFallback(player, bonusType) {
    // Check if any active item of this bonus type still exists
    const currentBonus = getActiveBonus(player, bonusType);
    if (currentBonus > 0)
        return; // Something is still active
    // Find unused items of the same bonus type, pick strongest
    let bestDef = null;
    let bestItem = null;
    for (const [itemId, items] of Object.entries(player.productionGoods)) {
        const def = defMap.get(itemId);
        if (!def || def.bonusType !== bonusType)
            continue;
        for (const item of items) {
            if (!item.isUsed && (!bestDef || def.bonusValue > bestDef.bonusValue)) {
                bestDef = { itemId, bonusValue: def.bonusValue };
                bestItem = item;
            }
        }
    }
    if (bestItem) {
        bestItem.isUsed = true;
    }
}
function getDefinition(itemId) {
    return defMap.get(itemId);
}
//# sourceMappingURL=productionGoodUtils.js.map