import Player from "../../core/database/game/models/Player";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Materials } from "../../core/database/game/models/Material";
import { MaterialDataController } from "../Material";
import { updateCollectMaterialsMission } from "../../core/utils/MaterialLootUtils";
import {
	isRangeValid, OutcomeRange
} from "./OutcomeRange";

/**
 * Filters selecting materials: every filter set must match
 */
export type OutcomeMaterialFilter = {
	type?: string;
	rarity?: OutcomeRange;
	ids?: number[];
};

/**
 * Material filters with the quantity to consume or to give
 */
export type OutcomeMaterialQuantity = OutcomeMaterialFilter & { quantity: number };

/**
 * Materials an outcome consumes: one filter, or several that must all be satisfied (wood and metal, for instance).
 * The filters of a list must not overlap, or a material could be counted for two of them.
 */
export type OutcomeMaterialConsumption = OutcomeMaterialQuantity | OutcomeMaterialQuantity[];

/**
 * The filters of a material consumption, as a list
 */
export function getMaterialQuantities(consumption: OutcomeMaterialConsumption): OutcomeMaterialQuantity[] {
	return Array.isArray(consumption) ? consumption : [consumption];
}

/**
 * A material quantity won (positive) or consumed (negative) by an outcome
 */
export type OutcomeMaterialChange = {
	materialId: number;
	quantity: number;
};

/**
 * Check if a material matches every filter set
 * @param materialId - The material to check
 * @param filter - The material filters
 */
export function isMaterialMatching(materialId: number, filter: OutcomeMaterialFilter): boolean {
	const material = MaterialDataController.instance.getById(String(materialId));
	if (!material) {
		return false;
	}
	const isIdAllowed = !filter.ids || filter.ids.includes(materialId);
	const isTypeAllowed = !filter.type || material.type === filter.type;
	return isIdAllowed && isTypeAllowed && isRangeValid(filter.rarity, material.rarity);
}

/**
 * Count the player's materials matching the filters
 * @param player - The player owning the materials
 * @param filter - The material filters
 */
export async function countMatchingMaterials(player: Player, filter: OutcomeMaterialFilter): Promise<number> {
	return (await Materials.getPlayerMaterials(player.id))
		.filter(owned => isMaterialMatching(owned.materialId, filter))
		.reduce((total, owned) => total + owned.quantity, 0);
}

/**
 * Sort materials from the most plentiful to the least, then by id to keep the order stable
 */
function compareByPlenty(a: OutcomeMaterialChange, b: OutcomeMaterialChange): number {
	return b.quantity - a.quantity || a.materialId - b.materialId;
}

/**
 * Choose which of the owned materials to consume: the matching ones, the most plentiful first
 * @param owned - The materials owned by the player
 * @param filter - The material filters
 * @param quantity - The quantity to consume
 * @returns the materials to consume, or an empty list when the player does not own enough of them
 */
export function pickMaterialsToConsume(owned: OutcomeMaterialChange[], filter: OutcomeMaterialFilter, quantity: number): OutcomeMaterialChange[] {
	const candidates = owned
		.filter(material => material.quantity > 0 && isMaterialMatching(material.materialId, filter))
		.sort(compareByPlenty);
	const picked: OutcomeMaterialChange[] = [];
	let remaining = quantity;
	for (const material of candidates) {
		if (remaining <= 0) {
			break;
		}
		const taken = Math.min(remaining, material.quantity);
		picked.push({
			materialId: material.materialId,
			quantity: taken
		});
		remaining -= taken;
	}
	return remaining > 0 ? [] : picked;
}

/**
 * Pick the materials of every filter, each filter picking among what the previous ones left
 * @returns the picked materials, or an empty list when one filter cannot be satisfied
 */
function pickMaterialsForEveryFilter(owned: OutcomeMaterialChange[], filters: OutcomeMaterialQuantity[]): OutcomeMaterialChange[] {
	const remaining = owned.map(m => ({ ...m }));
	const picked: OutcomeMaterialChange[] = [];
	for (const filter of filters) {
		const pickedForFilter = pickMaterialsToConsume(remaining, filter, filter.quantity);
		if (pickedForFilter.length === 0) {
			return [];
		}
		for (const material of pickedForFilter) {
			const left = remaining.find(m => m.materialId === material.materialId);
			if (left) {
				left.quantity -= material.quantity;
			}
			picked.push(material);
		}
	}
	return picked;
}

/**
 * Consume the player's materials matching the filters
 * @returns the consumed materials as negative changes, or an empty list when nothing was consumed
 */
async function consumeOutcomeMaterials(toConsume: OutcomeMaterialConsumption, player: Player): Promise<OutcomeMaterialChange[]> {
	const owned = (await Materials.getPlayerMaterials(player.id)).map(m => ({
		materialId: m.materialId,
		quantity: m.quantity
	}));
	const picked = pickMaterialsForEveryFilter(owned, getMaterialQuantities(toConsume));
	if (picked.length === 0 || !await Materials.consumeMaterials(player.id, picked)) {
		return [];
	}
	return picked.map(m => ({
		materialId: m.materialId,
		quantity: -m.quantity
	}));
}

/**
 * Give the player one random material matching the filters
 * @returns the given material, or an empty list when no material matches the filters
 */
async function giveOutcomeMaterials(toGive: OutcomeMaterialQuantity, player: Player, response: CrowniclesPacket[]): Promise<OutcomeMaterialChange[]> {
	const candidates = MaterialDataController.instance.getAllMaterials()
		.filter(material => isMaterialMatching(parseInt(material.id, 10), toGive));
	if (candidates.length === 0) {
		return [];
	}
	const given = {
		materialId: parseInt(RandomUtils.crowniclesRandom.pick(candidates).id, 10),
		quantity: toGive.quantity
	};
	await Materials.giveMaterial(player.id, given.materialId, given.quantity);
	await updateCollectMaterialsMission(player, response, [given]);
	return [given];
}

/**
 * Apply the material consumption then the material reward of an outcome
 * @returns every material change, consumed ones being negative
 */
export async function applyOutcomeMaterials(
	materials: {
		consume?: OutcomeMaterialConsumption; give?: OutcomeMaterialQuantity;
	},
	player: Player,
	response: CrowniclesPacket[]
): Promise<OutcomeMaterialChange[]> {
	const consumed = materials.consume ? await consumeOutcomeMaterials(materials.consume, player) : [];
	const given = materials.give ? await giveOutcomeMaterials(materials.give, player, response) : [];
	return [...consumed, ...given];
}
