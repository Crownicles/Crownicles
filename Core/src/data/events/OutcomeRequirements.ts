import Player from "../../core/database/game/models/Player";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import PetEntity, { PetEntities } from "../../core/database/game/models/PetEntity";
import { PetUtils } from "../../core/utils/PetUtils";
import { getNextBedAvailableAt } from "../../core/utils/BedUtils";
import {
	EquippedMainItem, PlayerActiveObjects
} from "../../core/database/game/models/PlayerActiveObjects";
import { PetDataController } from "../Pet";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import {
	PetConstants, PetTag
} from "../../../../Lib/src/constants/PetConstants";
import { EventOutcomeBadge } from "../../../../Lib/src/types/Badge";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";
import {
	isRangeValid, OutcomeRange
} from "./OutcomeRange";
import {
	countMatchingMaterials, getMaterialQuantities, OutcomeMaterialConsumption, OutcomeMaterialFilter
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

	/**
	 * Fight energy the player has left, in percent of their maximum fight energy (0 to 100)
	 */
	energyPercent?: OutcomeRange;

	/**
	 * Coins the player currently carries
	 */
	money?: OutcomeRange;
	campaignCurrentMissionId?: number;
	validPetTypeIds?: number[];

	/**
	 * The outcome is hidden when the player's pet is one of these types: the outcome hunts, cooks or fights that animal
	 */
	excludedPetTypeIds?: number[];

	/**
	 * The player's pet has at least one of these tags (an ability shared by several pets, such as flying)
	 */
	petTags?: PetTag[];
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

	/**
	 * The equipped weapon has at least one of these item tags (blunt, fire, ranged…)
	 */
	weaponTags?: string[];

	/**
	 * The player owns at least one of these badges (only the badges of EVENT_OUTCOME_BADGES)
	 */
	badges?: EventOutcomeBadge[];
};

/**
 * Check if the player can get an outcome: they meet its requirements and own the materials it consumes
 * @param outcome - The outcome requirements and consumed materials
 * @param player - The player to check the outcome against
 * @param playerActiveObjects - The player's active objects, used to calculate stats
 */
export async function isOutcomeValidForPlayer(
	outcome: {
		requirements?: OutcomeRequirements; consumeMaterials?: OutcomeMaterialConsumption; useBed?: boolean;
	},
	player: Player,
	playerActiveObjects: PlayerActiveObjects
): Promise<boolean> {
	if (outcome.useBed && getNextBedAvailableAt(player.lastBedUsedAt, new Date()) !== null) {
		return false;
	}

	if (outcome.consumeMaterials && !await areConsumedMaterialsOwned(outcome.consumeMaterials, player)) {
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
 * Check that the player owns enough materials for every filter of the consumption
 */
async function areConsumedMaterialsOwned(consumption: OutcomeMaterialConsumption, player: Player): Promise<boolean> {
	for (const filter of getMaterialQuantities(consumption)) {
		if (!await areMaterialsValid({
			...filter,
			quantity: { min: filter.quantity }
		}, player)) {
			return false;
		}
	}
	return true;
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
		[req.money, player.money],
		[req.cookingLevel, player.cookingLevel ?? 0],
		[req.weaponLevel, playerActiveObjects.weapon?.itemLevel ?? 0],
		[req.armorLevel, playerActiveObjects.armor?.itemLevel ?? 0]
	];
	return rangeChecks.every(([range, value]) => isRangeValid(range, value))
		&& (!req.energyPercent || isRangeValid(req.energyPercent, Math.floor(player.getRatioCumulativeEnergy(playerActiveObjects) * 100)))
		&& isClassValid(req.validClassIds, player.class)
		&& isEnchantmentValid(req.enchantment, playerActiveObjects)
		&& (!req.weaponTags || req.weaponTags.some(tag => playerActiveObjects.weapon?.item.tags?.includes(tag)));
}

/**
 * Check the requirements that need a database read: campaign progression and pet
 */
async function areProgressionRequirementsValid(req: OutcomeRequirements, player: Player): Promise<boolean> {
	return await isCampaignMissionValid(req.campaignCurrentMissionId, player)
		&& await isPetTypeValid(req.validPetTypeIds, player)
		&& await isPetTypeNotExcluded(req.excludedPetTypeIds, player)
		&& await isPetDataValid(req, player)
		&& await areMaterialsValid(req.materials, player)
		&& await areBadgesValid(req.badges, player);
}

/**
 * Check if the player owns at least one of the required badges
 * @param badges - The accepted badges
 * @param player - The player to check
 */
async function areBadgesValid(badges: EventOutcomeBadge[] | undefined, player: Player): Promise<boolean> {
	if (!badges) {
		return true;
	}
	const owned = await PlayerBadgesManager.getOfPlayer(player.id);
	return badges.some(badge => owned.includes(badge));
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

	const petEntity = await getAvailablePetEntity(player);
	return petEntity !== null && validPetTypeIds.includes(petEntity.typeId);
}

/**
 * Check that the player's pet is not one of the excluded types (a player without an available pet is never excluded)
 * @param excludedPetTypeIds - The pet types that make the outcome illogical
 * @param player - The player to check
 */
async function isPetTypeNotExcluded(excludedPetTypeIds: number[] | undefined, player: Player): Promise<boolean> {
	if (!excludedPetTypeIds) {
		return true;
	}

	const petEntity = await getAvailablePetEntity(player);
	return petEntity === null || !excludedPetTypeIds.includes(petEntity.typeId);
}

/**
 * Get the player's pet if it can take part in a big event: a pet on an expedition only counts with the clone talisman
 * @param player - The player whose pet is read
 */
export async function getAvailablePetEntity(player: Player): Promise<PetEntity | null> {
	if (!player.petId || !await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.BIG_EVENT)) {
		return null;
	}
	return await PetEntities.getById(player.petId);
}

/**
 * Check if the player's pet rarity and tags match the requirement
 * @param req - The requirements, of which the pet rarity range and the pet tags are checked
 * @param player - The player to check
 */
async function isPetDataValid(req: OutcomeRequirements, player: Player): Promise<boolean> {
	const {
		petRarity, petTags
	} = req;
	if (!petRarity && !petTags) {
		return true;
	}

	const petEntity = await getAvailablePetEntity(player);
	const petData = petEntity ? PetDataController.instance.getById(petEntity.typeId) : undefined;
	if (!petData) {
		return false;
	}
	return isRangeValid(petRarity, petData.rarity)
		&& (!petTags || petTags.some(tag => petData.hasTag(tag)));
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
