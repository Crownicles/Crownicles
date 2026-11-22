import Player from "../../core/database/game/models/Player";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import {
	EquippedMainItem, PlayerActiveObjects
} from "../../core/database/game/models/PlayerActiveObjects";
import { PetDataController } from "../Pet";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import {
	isRangeValid, OutcomeRange
} from "./OutcomeRange";
import {
	countMatchingMaterials, OutcomeMaterialFilter, OutcomeMaterialQuantity
} from "./OutcomeMaterials";

/**
 * Enchantment carried by one of the player's equipped weapon and armor
 */
export type OutcomeEnchantmentRequirement = {
	slot?: "weapon" | "armor";
	types?: string[];
	kinds?: string[];
	level?: OutcomeRange;
};

/**
 * Material filters with the range of the total quantity owned
 */
export type OutcomeMaterialsRequirement = OutcomeMaterialFilter & { quantity?: OutcomeRange };

export type OutcomeRequirements = {
	level?: OutcomeRange;
	karma?: OutcomeRange;
	health?: OutcomeRange;
	defense?: OutcomeRange;
	attack?: OutcomeRange;
	speed?: OutcomeRange;
	campaignCurrentMissionId?: number;
	validPetTypeIds?: number[];
	petRarity?: OutcomeRange;
	validClassIds?: number[];

	/**
	 * Cooking level of the player
	 */
	cookingLevel?: OutcomeRange;

	/**
	 * Total quantity of the player's materials matching the filters (all materials when no filter is set).
	 * The quantity range defaults to at least 1. Materials are only checked, never consumed.
	 */
	materials?: OutcomeMaterialsRequirement;

	/**
	 * At least one equipped weapon or armor (or the given slot only) carries an enchantment matching every filter
	 */
	enchantment?: OutcomeEnchantmentRequirement;

	/**
	 * Upgrade level of the equipped weapon
	 */
	weaponLevel?: OutcomeRange;

	/**
	 * Upgrade level of the equipped armor
	 */
	armorLevel?: OutcomeRange;
};

/**
 * Check if the player can get an outcome: they meet its requirements and own the materials it consumes
 * @param outcome - The outcome requirements and consumed materials
 * @param player - The player to check the outcome against
 * @param playerActiveObjects - The player's active objects, used to calculate stats
 */
export async function isOutcomeValidForPlayer(
	outcome: {
		requirements?: OutcomeRequirements; consumeMaterials?: OutcomeMaterialQuantity;
	},
	player: Player,
	playerActiveObjects: PlayerActiveObjects
): Promise<boolean> {
	if (outcome.consumeMaterials && !await areMaterialsValid({
		...outcome.consumeMaterials,
		quantity: { min: outcome.consumeMaterials.quantity }
	}, player)) {
		return false;
	}

	const req = outcome.requirements;
	if (!req) {
		return true;
	}

	return areStatRequirementsValid(req, player, playerActiveObjects)
		&& await areProgressionRequirementsValid(req, player);
}

/**
 * Check the requirements read from the player's own numbers: level, health, karma, fight stats and class
 */
function areStatRequirementsValid(
	req: OutcomeRequirements,
	player: Player,
	playerActiveObjects: PlayerActiveObjects
): boolean {
	const rangeChecks: [OutcomeRange | undefined, number][] = [
		[req.level, player.level],
		[req.health, player.getHealth()],
		[req.karma, player.karma],
		[req.defense, player.getCumulativeDefense(playerActiveObjects)],
		[req.attack, player.getCumulativeAttack(playerActiveObjects)],
		[req.speed, player.getCumulativeSpeed(playerActiveObjects)],
		[req.cookingLevel, player.cookingLevel ?? 0],
		[req.weaponLevel, playerActiveObjects.weapon?.itemLevel ?? 0],
		[req.armorLevel, playerActiveObjects.armor?.itemLevel ?? 0]
	];
	return rangeChecks.every(([range, value]) => isRangeValid(range, value))
		&& isClassValid(req.validClassIds, player.class)
		&& isEnchantmentValid(req.enchantment, playerActiveObjects);
}

/**
 * Check the requirements that need a database read: campaign progression and pet
 */
async function areProgressionRequirementsValid(req: OutcomeRequirements, player: Player): Promise<boolean> {
	return await isCampaignMissionValid(req.campaignCurrentMissionId, player)
		&& await isPetTypeValid(req.validPetTypeIds, player)
		&& await isPetRarityValid(req.petRarity, player)
		&& await areMaterialsValid(req.materials, player);
}

/**
 * Check if the player's class is valid, according to the requirements
 * @param validClassIds - The list of valid class IDs
 * @param playerClass - The player's class ID
 */
function isClassValid(validClassIds: number[] | undefined, playerClass: number): boolean {
	if (!validClassIds) {
		return true;
	}
	return validClassIds.includes(playerClass);
}

/**
 * Check if the player's current campaign mission matches the requirement
 * @param requiredCampaignMissionId - The required campaign mission ID
 * @param player - The player to check
 */
async function isCampaignMissionValid(requiredCampaignMissionId: number | undefined, player: Player): Promise<boolean> {
	if (requiredCampaignMissionId === undefined) {
		return true;
	}

	// Get the player's mission info to check their current campaign progression
	const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	return missionInfo.campaignProgression === requiredCampaignMissionId;
}

/**
 * Check if the player's pet type matches the requirement
 * @param validPetTypeIds - The list of valid pet type IDs
 * @param player - The player to check
 */
async function isPetTypeValid(validPetTypeIds: number[] | undefined, player: Player): Promise<boolean> {
	if (!validPetTypeIds) {
		return true;
	}

	// Check if player has a pet
	if (!player.petId) {
		return false;
	}

	// Get the player's pet and check if its type is in the valid list
	const petEntity = await PetEntities.getById(player.petId);
	return petEntity !== null && validPetTypeIds.includes(petEntity.typeId);
}

/**
 * Check if the player's pet rarity matches the requirement
 * @param petRarityRange - The required pet rarity range
 * @param player - The player to check
 */
async function isPetRarityValid(petRarityRange: OutcomeRange | undefined, player: Player): Promise<boolean> {
	if (!petRarityRange) {
		return true;
	}

	// Check if player has a pet
	if (!player.petId) {
		return false;
	}

	// Get the player's pet and its rarity from the pet data
	const petEntity = await PetEntities.getById(player.petId);
	if (!petEntity) {
		return false;
	}
	const petData = PetDataController.instance.getById(petEntity.typeId);
	return petData !== undefined && isRangeValid(petRarityRange, petData.rarity);
}

/**
 * Check if an equipped item carries an enchantment matching every filter of the requirement
 */
function isItemEnchantmentMatching(item: EquippedMainItem | undefined, requirement: OutcomeEnchantmentRequirement): boolean {
	const enchantment = item?.itemEnchantmentId ? ItemEnchantment.getById(item.itemEnchantmentId) : null;
	if (!enchantment) {
		return false;
	}
	const isTypeAllowed = !requirement.types || requirement.types.includes(enchantment.kind.type.id);
	const isKindAllowed = !requirement.kinds || requirement.kinds.includes(enchantment.kind.id);
	return isTypeAllowed && isKindAllowed && isRangeValid(requirement.level, enchantment.level);
}

/**
 * Check if one of the player's equipped weapon and armor carries an enchantment matching the requirement
 * @param requirement - The required slot, enchantment types, kinds and level
 * @param playerActiveObjects - The player's active objects
 */
function isEnchantmentValid(requirement: OutcomeEnchantmentRequirement | undefined, playerActiveObjects: PlayerActiveObjects): boolean {
	if (!requirement) {
		return true;
	}

	const equipped: (EquippedMainItem | undefined)[] = requirement.slot
		? [playerActiveObjects[requirement.slot]]
		: [playerActiveObjects.weapon, playerActiveObjects.armor];
	return equipped.some(item => isItemEnchantmentMatching(item, requirement));
}

/**
 * Check if the quantity of the player's materials matching the filters is within the required range
 * @param requirement - The material filters and the required quantity (at least 1 by default)
 * @param player - The player to check
 */
async function areMaterialsValid(requirement: OutcomeMaterialsRequirement | undefined, player: Player): Promise<boolean> {
	if (!requirement) {
		return true;
	}

	return isRangeValid(requirement.quantity ?? { min: 1 }, await countMatchingMaterials(player, requirement));
}
