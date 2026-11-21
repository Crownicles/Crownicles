import Player from "../../core/database/game/models/Player";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	generateRandomItem, generateRandomLootEnchantment, generateRandomLootLevel, giveItemToPlayer
} from "../../core/utils/ItemUtils";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerSmallEvents } from "../../core/database/game/models/PlayerSmallEvent";
import { Maps } from "../../core/maps/Maps";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { CommandReportBigEventResultRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	MapLink, MapLinkDataController
} from "../MapLink";
import { Effect } from "../../../../Lib/src/types/Effect";
import { TravelTime } from "../../core/maps/TravelTime";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { PossibilityOutcomeCondition } from "./PossibilityOutcomeCondition";
import { BigEventConstants } from "../../../../Lib/src/constants/BigEventConstants";
import {
	EquippedMainItem, PlayerActiveObjects
} from "../../core/database/game/models/PlayerActiveObjects";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { BlessingManager } from "../../core/blessings/BlessingManager";
import {
	asMinutes, minutesToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { PetDataController } from "../Pet";
import { Materials } from "../../core/database/game/models/Material";
import { MaterialDataController } from "../Material";
import { updateCollectMaterialsMission } from "../../core/utils/MaterialLootUtils";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";

async function applyOutcomeScore(outcome: PossibilityOutcome, time: number, player: Player, response: CrowniclesPacket[]): Promise<number> {
	const scoreChange = TravelTime.timeTravelledToScore(minutesToMilliseconds(asMinutes(time)))
		+ await PlayerSmallEvents.calculateCurrentScore(player)
		+ (outcome.bonusPoints ?? 0);
	const scoreParameters = {
		response,
		amount: scoreChange,
		reason: NumberChangeReason.BIG_EVENT
	};
	await player.addScore(scoreParameters);
	return scoreParameters.amount;
}

async function applyOutcomeExperience(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<number> {
	let experienceChange = BigEventConstants.EXPERIENCE.BASE
		+ ((outcome.health ?? 0) > 0 ? BigEventConstants.EXPERIENCE.HEALTH_BONUS : 0)
		+ (outcome.randomItem ? BigEventConstants.EXPERIENCE.RANDOM_ITEM_BONUS : 0)
		+ ((outcome.money ?? 0) > 0 ? BigEventConstants.EXPERIENCE.MONEY_BONUS : 0);
	switch (outcome.effect ?? Effect.NO_EFFECT.id) {
		case Effect.OCCUPIED.id:
			experienceChange -= BigEventConstants.EXPERIENCE.OCCUPIED_PENALTY;
			break;
		case Effect.SLEEPING.id:
		case Effect.STARVING.id:
			experienceChange -= BigEventConstants.EXPERIENCE.SLEEPING_STARVING_PENALTY;
			break;
		case Effect.CONFOUNDED.id:
			experienceChange -= BigEventConstants.EXPERIENCE.CONFOUNDED_PENALTY;
			break;
		case Effect.NO_EFFECT.id:
			break;
		default:
			experienceChange = 0;
	}
	if ((outcome.health ?? 0) < 0 || outcome.oneshot === true || experienceChange < 0) {
		experienceChange = 0;
	}
	experienceChange += outcome.bonusExperience ?? 0;
	if (experienceChange !== 0) {
		await player.addExperience({
			amount: experienceChange,
			reason: NumberChangeReason.BIG_EVENT,
			response
		});
		return experienceChange;
	}
	return 0;
}

async function applyOutcomeEffect(outcome: PossibilityOutcome, player: Player): Promise<{
	name: string;
	time: number;
} | undefined> {
	await player.setLastReportWithEffect(
		outcome.lostTime ?? 0,
		Effect.getById(outcome.effect ?? Effect.NO_EFFECT.id) ?? Effect.NO_EFFECT,
		NumberChangeReason.BIG_EVENT
	);

	if (outcome.effect) {
		return {
			time: player.effectDuration,
			name: player.effectId
		};
	}

	return undefined;
}

async function applyOutcomeHealth(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<number> {
	if (outcome.health && outcome.health !== 0) {
		await player.addHealth({
			amount: outcome.health,
			response,
			reason: NumberChangeReason.BIG_EVENT
		});
		return outcome.health;
	}
	return 0;
}

async function applyOutcomeKarma(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<number> {
	if (outcome.karma && outcome.karma !== 0) {
		await player.addKarma(outcome.karma, response, NumberChangeReason.BIG_EVENT);
		return outcome.karma;
	}
	return 0;
}

async function applyOutcomeMoneyUnderLock(outcome: PossibilityOutcome, time: number, player: Locked<Player>, response: CrowniclesPacket[]): Promise<number> {
	let moneyChange = (outcome.money ?? 0) + Math.round(time / 10 + RandomUtils.crowniclesRandom.integer(0, time / 10 + player.level / 5 - 1));
	if (outcome.money && outcome.money < 0 && moneyChange > 0) {
		moneyChange = Math.floor(outcome.money / 2);
	}
	if (moneyChange === 0) {
		return 0;
	}
	const isMoneyChangePositive = moneyChange > 0;
	const moneyChangeAbs = Math.abs(moneyChange);
	if (!isMoneyChangePositive && outcome.tags?.includes("moneyUsage")) {
		await player.spendMoney({
			response,
			amount: moneyChangeAbs,
			reason: NumberChangeReason.BIG_EVENT
		});
	}
	else {
		await player.addMoney({
			response,
			amount: moneyChange,
			reason: NumberChangeReason.BIG_EVENT
		});
	}
	if (!isMoneyChangePositive) {
		await player.save();
	}
	return BlessingManager.getInstance().applyMoneyBlessing(moneyChange);
}

function applyOutcomeEnergy(outcome: PossibilityOutcome, player: Player, playerActiveObjects: PlayerActiveObjects): number {
	if (outcome.energy && outcome.energy !== 0) {
		player.addEnergy(outcome.energy, NumberChangeReason.BIG_EVENT, playerActiveObjects);
		return outcome.energy;
	}
	return 0;
}

async function applyOutcomeGems(outcome: PossibilityOutcome, player: Player): Promise<number> {
	if (outcome.gems && outcome.gems !== 0) {
		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		await missionInfo.addGems(outcome.gems, player.keycloakId, NumberChangeReason.BIG_EVENT);
		return outcome.gems;
	}
	return 0;
}

async function applyOutcomeTokens(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<number> {
	if (outcome.tokens && outcome.tokens !== 0) {
		const previousTokens = player.tokens;
		await player.addTokens({
			response,
			amount: outcome.tokens,
			reason: NumberChangeReason.BIG_EVENT
		});
		return player.tokens - previousTokens;
	}
	return 0;
}

async function applyOutcomeRandomItem(outcome: PossibilityOutcome, player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	if (!outcome.randomItem) {
		return;
	}
	const item = generateRandomItem({
		itemCategory: outcome.randomItem.category,
		minRarity: outcome.randomItem.rarity?.min,
		maxRarity: outcome.randomItem.rarity?.max
	});
	await giveItemToPlayer(response, context, player, item, {
		canDrinkImmediately: false,
		itemLevel: generateRandomLootLevel(),
		itemEnchantmentId: generateRandomLootEnchantment(item)
	});
}

async function applyOutcomeMaterials(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<OutcomeMaterialChange[]> {
	const changes: OutcomeMaterialChange[] = [];
	if (outcome.consumeMaterials) {
		const owned = (await Materials.getPlayerMaterials(player.id)).map(m => ({
			materialId: m.materialId,
			quantity: m.quantity
		}));
		const toConsume = pickMaterialsToConsume(owned, outcome.consumeMaterials, outcome.consumeMaterials.quantity);
		if (toConsume.length > 0 && await Materials.consumeMaterials(player.id, toConsume)) {
			changes.push(...toConsume.map(m => ({
				materialId: m.materialId,
				quantity: -m.quantity
			})));
		}
	}
	if (outcome.giveMaterials) {
		const filter = outcome.giveMaterials;
		const candidates = MaterialDataController.instance.getAllMaterials()
			.filter(material => isMaterialMatching(parseInt(material.id, 10), filter));
		if (candidates.length > 0) {
			const materialId = parseInt(RandomUtils.crowniclesRandom.pick(candidates).id, 10);
			const given = {
				materialId,
				quantity: filter.quantity
			};
			await Materials.giveMaterial(player.id, materialId, filter.quantity);
			await updateCollectMaterialsMission(player, response, [given]);
			changes.push(given);
		}
	}
	return changes;
}

async function applyOutcomeRandomPet(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<void> {
	if (outcome.randomPet) {
		const minRarity = outcome.randomPet.rarity?.min ?? PetConstants.PET_RARITY_RANGE.MIN;
		const maxRarity = outcome.randomPet.rarity?.max ?? PetConstants.PET_RARITY_RANGE.MAX;

		const pet = PetEntities.generateRandomPetEntityNotGuild(minRarity, maxRarity);
		await pet.giveToPlayer(player, response);
	}
}

async function applyOutcomeGivePet(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<void> {
	if (outcome.givePet) {
		const petId = RandomUtils.crowniclesRandom.pick(outcome.givePet.petIds);
		const sex = RandomUtils.crowniclesRandom.bool() ? PetConstants.SEX.MALE : PetConstants.SEX.FEMALE;
		const pet = PetEntities.createPet(petId, sex, "");
		await pet.giveToPlayer(player, response);
	}
}

async function applyOutcomeOneshot(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<void> {
	if (outcome.oneshot === true) {
		await player.addHealth({
			amount: -player.getHealthValue(),
			response,
			reason: NumberChangeReason.BIG_EVENT
		});
	}
}

function applyOutcomeNextEvent(outcome: PossibilityOutcome, player: Player): void {
	if (outcome.nextEvent) {
		player.nextEvent = outcome.nextEvent;
	}
}

function getMapTypesDestinationLink(outcome: PossibilityOutcome, player: Player): MapLink {
	const {
		mapTypesDestination, mapTypesExcludeDestination
	} = outcome;

	let allowedMapTypes = Maps.getConnectedMapTypes(player, !mapTypesDestination);
	if (mapTypesDestination) {
		allowedMapTypes = allowedMapTypes.filter(mapType => mapTypesDestination.includes(mapType));
	}
	if (mapTypesExcludeDestination) {
		allowedMapTypes = allowedMapTypes.filter(mapType => !mapTypesExcludeDestination.includes(mapType));
	}

	return RandomUtils.crowniclesRandom.pick(
		MapLinkDataController.instance.getMapLinksWithMapTypes(
			allowedMapTypes,
			player.getDestinationId() ?? -1,
			mapTypesDestination ? -1 : player.getPreviousMapId() ?? -1
		)
	);
}

function getNextMapLink(outcome: PossibilityOutcome, player: Player): MapLink | null {
	if (outcome.mapLink) {
		return MapLinkDataController.instance.getById(outcome.mapLink) ?? null;
	}

	if (outcome.mapTypesDestination || outcome.mapTypesExcludeDestination) {
		return getMapTypesDestinationLink(outcome, player);
	}

	return null;
}

/**
 * Tuple representing a possibility outcome keyed by its id alongside its data.
 * Used everywhere outcomes are passed around `Object.entries`-style.
 */
export type PossibilityOutcomeEntry = [string, PossibilityOutcome];

type ApplyOutcome = {
	eventId: number;
	possibilityName: string;
	outcome: PossibilityOutcomeEntry;
	time: number;
};

/**
 * Apply a possibility outcome to a player
 * @param possibilityOutcome
 * @param player
 * @param context
 * @param response
 */
export async function applyPossibilityOutcome(possibilityOutcome: ApplyOutcome, player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<MapLink | null> {
	// Get player active objects for energy changes
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

	// Score
	const score = await applyOutcomeScore(possibilityOutcome.outcome[1], possibilityOutcome.time, player, response);

	// Money
	const money = await applyOutcomeMoneyUnderLock(possibilityOutcome.outcome[1], possibilityOutcome.time, player, response);

	// Gems
	const gems = await applyOutcomeGems(possibilityOutcome.outcome[1], player);

	// Tokens
	const tokens = await applyOutcomeTokens(possibilityOutcome.outcome[1], player, response);

	// Experience
	const experience = await applyOutcomeExperience(possibilityOutcome.outcome[1], player, response);

	// Health
	const health = await applyOutcomeHealth(possibilityOutcome.outcome[1], player, response);

	// Karma
	await applyOutcomeKarma(possibilityOutcome.outcome[1], player, response);

	// Energy
	const energy = applyOutcomeEnergy(possibilityOutcome.outcome[1], player, playerActiveObjects);

	// Effect + lost time
	const effect = await applyOutcomeEffect(possibilityOutcome.outcome[1], player);

	// Materials
	const materials = await applyOutcomeMaterials(possibilityOutcome.outcome[1], player, response);

	const packet = makePacket(CommandReportBigEventResultRes, {
		eventId: possibilityOutcome.eventId,
		possibilityId: possibilityOutcome.possibilityName,
		outcomeId: possibilityOutcome.outcome[0],
		score,
		money,
		health,
		energy,
		gems,
		tokens,
		experience,
		effect,
		materials,
		oneshot: possibilityOutcome.outcome[1].oneshot ?? false
	});

	response.push(packet);

	// Random item
	await applyOutcomeRandomItem(possibilityOutcome.outcome[1], player, context, response);

	// Random pet
	await applyOutcomeRandomPet(possibilityOutcome.outcome[1], player, response);

	// Give pet
	await applyOutcomeGivePet(possibilityOutcome.outcome[1], player, response);

	// Next event
	applyOutcomeNextEvent(possibilityOutcome.outcome[1], player);

	// Oneshot
	await applyOutcomeOneshot(possibilityOutcome.outcome[1], player, response);

	// Forced link
	return getNextMapLink(possibilityOutcome.outcome[1], player);
}

/**
 * Filters selecting materials: every filter set must match
 */
export type OutcomeMaterialFilter = {
	type?: string;
	rarity?: {
		min?: number;
		max?: number;
	};
	ids?: number[];
};

/**
 * A material quantity won (positive) or consumed (negative) by an outcome
 */
export type OutcomeMaterialChange = {
	materialId: number;
	quantity: number;
};

export interface PossibilityOutcome {

	condition?: PossibilityOutcomeCondition;

	requirements?: {
		level?: {
			min?: number;
			max?: number;
		};
		karma?: {
			min?: number;
			max?: number;
		};
		health?: {
			min?: number;
			max?: number;
		};
		defense?: {
			min?: number;
			max?: number;
		};
		attack?: {
			min?: number;
			max?: number;
		};
		speed?: {
			min?: number;
			max?: number;
		};
		campaignCurrentMissionId?: number;
		validPetTypeIds?: number[];
		petRarity?: {
			min?: number;
			max?: number;
		};
		validClassIds?: number[];

		/**
		 * Cooking level of the player
		 */
		cookingLevel?: {
			min?: number;
			max?: number;
		};

		/**
		 * Total quantity of the player's materials matching the filters (all materials when no filter is set).
		 * The quantity range defaults to at least 1. Materials are only checked, never consumed.
		 */
		materials?: OutcomeMaterialFilter & {
			quantity?: {
				min?: number;
				max?: number;
			};
		};

		/**
		 * At least one equipped weapon or armor (or the given slot only) carries an enchantment matching every filter
		 */
		enchantment?: {
			slot?: "weapon" | "armor";
			types?: string[];
			kinds?: string[];
			level?: {
				min?: number;
				max?: number;
			};
		};

		/**
		 * Upgrade level of the equipped weapon
		 */
		weaponLevel?: {
			min?: number;
			max?: number;
		};

		/**
		 * Upgrade level of the equipped armor
		 */
		armorLevel?: {
			min?: number;
			max?: number;
		};
	};

	/**
	 * Time lost for the lost time effect
	 */
	lostTime?: number;

	/**
	 * Health lost or won
	 */
	health?: number;

	/**
	 * Karma lost or won
	 */
	karma?: number;

	/**
	 * Effect to apply
	 */
	effect?: string;

	/**
	 * Money lost or won
	 */
	money?: number;

	/**
	 * Energy lost or won
	 */
	energy?: number;

	/**
	 * Gems lost or won
	 */
	gems?: number;

	/**
	 * Tokens won (reward-like, may push the player above the normal token cap)
	 */
	tokens?: number;

	/**
	 * Bonus experience (will be added to calculated experience)
	 */
	bonusExperience?: number;

	/**
	 * Bonus points (will be added to calculated points)
	 */
	bonusPoints?: number;

	/**
	 * Give a random item
	 */
	randomItem?: {
		category?: number;
		rarity?: {
			min?: number;
			max?: number;
		};
	};

	/**
	 * Give a random pet
	 */
	randomPet?: {
		rarity?: {
			min?: number;
			max?: number;
		};
	};

	givePet?: { petIds: number[] };

	/**
	 * Consume this quantity of the player's materials matching the filters, taken from the most plentiful first.
	 * The outcome is only possible when the player owns enough of them.
	 */
	consumeMaterials?: OutcomeMaterialFilter & { quantity: number };

	/**
	 * Give this quantity of one random material matching the filters
	 */
	giveMaterials?: OutcomeMaterialFilter & { quantity: number };

	/**
	 * One shot the player
	 */
	oneshot?: boolean;

	/**
	 * Forced next event
	 */
	nextEvent?: number;

	/**
	 * Choose a random map type to go in the list
	 */
	mapTypesDestination?: string[];

	/**
	 * Exclude these map types in the destination choice
	 */
	mapTypesExcludeDestination?: string[];

	/**
	 * Forced map link
	 */
	mapLink?: number;

	/**
	 * Force the player to stay in the city after the outcome: the destination
	 * menu is skipped and the player enters the city directly, until they
	 * explicitly leave via the report command. Ignored when a forced map link
	 * is set or when the player is not on a city map location.
	 */
	forceStayInCity?: boolean;

	/**
	 * Prevent the player from staying in the city after the outcome while still
	 * allowing them to choose their next destination.
	 */
	forceLeaveCity?: boolean;

	/**
	 * Tags
	 */
	tags?: string[];
}

/**
 * Get the valid outcomes for a player based on their requirements and the player state
 * @param outcomes - The outcomes to filter
 * @param player - The player to check the outcomes against
 */
export async function getValidOutcomesForPlayer(
	outcomes: { [key: string]: PossibilityOutcome },
	player: Player
): Promise<[string, PossibilityOutcome][]> {
	const playerActiveObjects: PlayerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
	const validOutcomes: [string, PossibilityOutcome][] = [];

	for (const [key, outcome] of Object.entries(outcomes)) {
		if (await isOutcomeValidForPlayer(outcome, player, playerActiveObjects)) {
			validOutcomes.push([key, outcome]);
		}
	}

	return validOutcomes;
}

/**
 * Check if a specific outcome is valid for the given player
 * @param outcome - The outcome to check
 * @param player - The player to check the outcome against
 * @param playerActiveObjects - The player's active objects, used to calculate stats
 */
async function isOutcomeValidForPlayer(
	outcome: PossibilityOutcome,
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

type OutcomeRequirements = NonNullable<PossibilityOutcome["requirements"]>;

type OutcomeRange = {
	min?: number;
	max?: number;
};

/**
 * Check if a value falls within the specified range requirements
 */
function isRangeValid(range: OutcomeRange | undefined, value: number): boolean {
	if (!range) {
		return true;
	}

	if (range.min !== undefined && value < range.min) {
		return false;
	}

	return !(range.max !== undefined && value > range.max);
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
async function isPetRarityValid(
	petRarityRange: {
		min?: number; max?: number;
	} | undefined,
	player: Player
): Promise<boolean> {
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
 * Check if one of the player's equipped weapon and armor carries an enchantment matching the requirement
 * @param requirement - The required slot, enchantment types, kinds and level
 * @param playerActiveObjects - The player's active objects
 */
function isEnchantmentValid(requirement: OutcomeRequirements["enchantment"], playerActiveObjects: PlayerActiveObjects): boolean {
	if (!requirement) {
		return true;
	}

	const equipped: (EquippedMainItem | undefined)[] = requirement.slot
		? [playerActiveObjects[requirement.slot]]
		: [playerActiveObjects.weapon, playerActiveObjects.armor];
	return equipped.some(item => {
		const enchantment = item?.itemEnchantmentId ? ItemEnchantment.getById(item.itemEnchantmentId) : null;
		return enchantment !== null
			&& (!requirement.types || requirement.types.includes(enchantment.kind.type.id))
			&& (!requirement.kinds || requirement.kinds.includes(enchantment.kind.id))
			&& isRangeValid(requirement.level, enchantment.level);
	});
}

/**
 * Check if the quantity of the player's materials matching the filters is within the required range
 * @param requirement - The material filters and the required quantity (at least 1 by default)
 * @param player - The player to check
 */
async function areMaterialsValid(requirement: OutcomeRequirements["materials"], player: Player): Promise<boolean> {
	if (!requirement) {
		return true;
	}

	const quantity = (await Materials.getPlayerMaterials(player.id))
		.filter(owned => isMaterialMatching(owned.materialId, requirement))
		.reduce((total, owned) => total + owned.quantity, 0);
	return isRangeValid(requirement.quantity ?? { min: 1 }, quantity);
}

/**
 * Check if a material matches every filter set
 * @param materialId - The material to check
 * @param filter - The material filters
 */
function isMaterialMatching(materialId: number, filter: OutcomeMaterialFilter): boolean {
	const material = MaterialDataController.instance.getById(String(materialId));
	return material !== undefined
		&& (!filter.ids || filter.ids.includes(materialId))
		&& (!filter.type || material.type === filter.type)
		&& isRangeValid(filter.rarity, material.rarity);
}

/**
 * Choose which of the owned materials to consume: the matching ones, the most plentiful first
 * @param owned - The materials owned by the player
 * @param filter - The material filters
 * @param quantity - The quantity to consume
 * @returns the materials to consume, or an empty list when the player does not own enough of them
 */
export function pickMaterialsToConsume(owned: OutcomeMaterialChange[], filter: OutcomeMaterialFilter, quantity: number): OutcomeMaterialChange[] {
	const picked: OutcomeMaterialChange[] = [];
	let remaining = quantity;
	for (const material of owned
		.filter(m => m.quantity > 0 && isMaterialMatching(m.materialId, filter))
		.sort((a, b) => b.quantity - a.quantity || a.materialId - b.materialId)) {
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
