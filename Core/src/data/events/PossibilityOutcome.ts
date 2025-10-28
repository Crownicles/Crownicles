import Player from "../../core/database/game/models/Player";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	generateRandomItem, giveItemToPlayer
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
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { PetDataController } from "../Pet";

async function applyOutcomeScore(outcome: PossibilityOutcome, time: number, player: Player, response: CrowniclesPacket[]): Promise<number> {
	const scoreChange = TravelTime.timeTravelledToScore(time)
		+ await PlayerSmallEvents.calculateCurrentScore(player)
		+ (outcome.bonusPoints ?? 0);
	await player.addScore({
		response,
		amount: scoreChange,
		reason: NumberChangeReason.BIG_EVENT
	});
	return scoreChange;
}

async function applyOutcomeExperience(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<number> {
	let experienceChange = 150
		+ (outcome.health > 0 ? 200 : 0)
		+ (outcome.randomItem ? 300 : 0)
		+ (outcome.money > 0 ? 100 : 0);
	switch (outcome.effect ?? Effect.NO_EFFECT.id) {
		case Effect.OCCUPIED.id:
			experienceChange -= 125;
			break;
		case Effect.SLEEPING.id:
		case Effect.STARVING.id:
			experienceChange -= 130;
			break;
		case Effect.CONFOUNDED.id:
			experienceChange -= 140;
			break;
		case Effect.NO_EFFECT.id:
			break;
		default:
			experienceChange = 0;
	}
	if (outcome.health < 0 || outcome.oneshot === true || experienceChange < 0) {
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
		Effect.getById(outcome.effect) ?? Effect.NO_EFFECT,
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
		await player.addHealth(outcome.health, response, NumberChangeReason.BIG_EVENT);
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

async function applyOutcomeMoney(outcome: PossibilityOutcome, time: number, player: Player, response: CrowniclesPacket[]): Promise<number> {
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
	return moneyChange;
}

function applyOutcomeEnergy(outcome: PossibilityOutcome, player: Player): number {
	if (outcome.energy && outcome.energy !== 0) {
		player.addEnergy(outcome.energy, NumberChangeReason.BIG_EVENT);
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

async function applyOutcomeRandomItem(outcome: PossibilityOutcome, player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<void> {
	if (!outcome.randomItem) {
		return;
	}
	await giveItemToPlayer(response, context, player, generateRandomItem({
		itemCategory: outcome.randomItem.category,
		minRarity: outcome.randomItem.rarity?.min,
		maxRarity: outcome.randomItem.rarity?.max
	}), 1, false);
}

async function applyOutcomeRandomPet(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<void> {
	if (outcome.randomPet) {
		const minRarity = outcome.randomPet.rarity?.min ?? 1;
		const maxRarity = outcome.randomPet.rarity?.max ?? 5;

		const pet = PetEntities.generateRandomPetEntityNotGuild(minRarity, maxRarity);
		await pet.giveToPlayer(player, response);
	}
}

async function applyOutcomeOneshot(outcome: PossibilityOutcome, player: Player, response: CrowniclesPacket[]): Promise<void> {
	if (outcome.oneshot === true) {
		await player.addHealth(-player.health, response, NumberChangeReason.BIG_EVENT);
	}
}

function applyOutcomeNextEvent(outcome: PossibilityOutcome, player: Player): void {
	if (outcome.nextEvent) {
		player.nextEvent = outcome.nextEvent;
	}
}

function getNextMapLink(outcome: PossibilityOutcome, player: Player): MapLink {
	if (outcome.mapLink) {
		return MapLinkDataController.instance.getById(outcome.mapLink);
	}

	if (outcome.mapTypesDestination || outcome.mapTypesExcludeDestination) {
		let allowedMapTypes = Maps.getConnectedMapTypes(player, !outcome.mapTypesDestination);
		if (outcome.mapTypesDestination) {
			allowedMapTypes = allowedMapTypes.filter(mapType => outcome.mapTypesDestination.includes(mapType));
		}
		if (outcome.mapTypesExcludeDestination) {
			allowedMapTypes = allowedMapTypes.filter(mapType => !outcome.mapTypesExcludeDestination.includes(mapType));
		}

		return RandomUtils.crowniclesRandom.pick(
			MapLinkDataController.instance.getMapLinksWithMapTypes(
				allowedMapTypes,
				player.getDestinationId(),
				!outcome.mapTypesDestination ? player.getPreviousMapId() : null
			)
		);
	}

	return null;
}

type ApplyOutcome = {
	eventId: number;
	possibilityName: string;
	outcome: [string, PossibilityOutcome];
	time: number;
};

/**
 * Apply a possibility outcome to a player
 * @param possibilityOutcome
 * @param player
 * @param context
 * @param response
 */
export async function applyPossibilityOutcome(possibilityOutcome: ApplyOutcome, player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<MapLink> {
	// Score
	const score = await applyOutcomeScore(possibilityOutcome.outcome[1], possibilityOutcome.time, player, response);

	// Money
	const money = await applyOutcomeMoney(possibilityOutcome.outcome[1], possibilityOutcome.time, player, response);

	// Health
	const health = await applyOutcomeHealth(possibilityOutcome.outcome[1], player, response);

	// Karma
	await applyOutcomeKarma(possibilityOutcome.outcome[1], player, response);

	// Energy
	const energy = applyOutcomeEnergy(possibilityOutcome.outcome[1], player);

	// Gems
	const gems = await applyOutcomeGems(possibilityOutcome.outcome[1], player);

	// Experience
	const experience = await applyOutcomeExperience(possibilityOutcome.outcome[1], player, response);

	// Effect + lost time
	const effect = await applyOutcomeEffect(possibilityOutcome.outcome[1], player);

	const packet = makePacket(CommandReportBigEventResultRes, {
		eventId: possibilityOutcome.eventId,
		possibilityId: possibilityOutcome.possibilityName,
		outcomeId: possibilityOutcome.outcome[0],
		score,
		money,
		health,
		energy,
		gems,
		experience,
		effect,
		oneshot: possibilityOutcome.outcome[1].oneshot ?? false
	});

	response.push(packet);

	// Random item
	await applyOutcomeRandomItem(possibilityOutcome.outcome[1], player, context, response);

	// Random pet
	await applyOutcomeRandomPet(possibilityOutcome.outcome[1], player, response);

	// Next event
	applyOutcomeNextEvent(possibilityOutcome.outcome[1], player);

	// Oneshot
	await applyOutcomeOneshot(possibilityOutcome.outcome[1], player, response);

	// Forced link
	return getNextMapLink(possibilityOutcome.outcome[1], player);
}

export interface PossibilityOutcome {

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
	const req = outcome.requirements;
	if (!req) {
		return true;
	}

	// Check all requirement types
	return (
		isRangeValid(req.level, player.level)
		&& isRangeValid(req.health, player.health)
		&& isRangeValid(req.karma, player.karma)
		&& isRangeValid(req.defense, player.getCumulativeDefense(playerActiveObjects))
		&& isRangeValid(req.attack, player.getCumulativeAttack(playerActiveObjects))
		&& isRangeValid(req.speed, player.getCumulativeSpeed(playerActiveObjects))
		&& isClassValid(req.validClassIds, player.class)
		&& await isCampaignMissionValid(req.campaignCurrentMissionId, player)
		&& await isPetTypeValid(req.validPetTypeIds, player)
		&& await isPetRarityValid(req.petRarity, player)
	);
}

/**
 * Check if a value falls within the specified range requirements
 */
function isRangeValid(
	range: {
		min?: number; max?: number;
	} | undefined,
	value: number
): boolean {
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
	return petEntity && validPetTypeIds.includes(petEntity.typeId);
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
	const petData = PetDataController.instance.getById(petEntity.typeId);
	return isRangeValid(petRarityRange, petData.rarity);
}

