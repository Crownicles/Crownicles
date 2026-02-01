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
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { PossibilityOutcomeCondition } from "./PossibilityOutcomeCondition";
import { BigEventConstants } from "../../../../Lib/src/constants/BigEventConstants";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";

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
		await player.addExperienceSimple({
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
		await player.addHealthSimple({
			amount: outcome.health,
			response,
			reason: NumberChangeReason.BIG_EVENT
		});
		return outcome.health;
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
		await player.addHealthSimple({
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

function getNextMapLink(outcome: PossibilityOutcome, player: Player): MapLink | null {
	if (outcome.mapLink) {
		return MapLinkDataController.instance.getById(outcome.mapLink) ?? null;
	}

	if (outcome.mapTypesDestination || outcome.mapTypesExcludeDestination) {
		let allowedMapTypes = Maps.getConnectedMapTypes(player, !outcome.mapTypesDestination);
		if (outcome.mapTypesDestination) {
			allowedMapTypes = allowedMapTypes.filter(mapType => outcome.mapTypesDestination!.includes(mapType));
		}
		if (outcome.mapTypesExcludeDestination) {
			allowedMapTypes = allowedMapTypes.filter(mapType => !outcome.mapTypesExcludeDestination!.includes(mapType));
		}

		return RandomUtils.crowniclesRandom.pick(
			MapLinkDataController.instance.getMapLinksWithMapTypes(
				allowedMapTypes,
				player.getDestinationId() ?? -1,
				!outcome.mapTypesDestination ? player.getPreviousMapId() ?? -1 : -1
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
export async function applyPossibilityOutcome(possibilityOutcome: ApplyOutcome, player: Player, context: PacketContext, response: CrowniclesPacket[]): Promise<MapLink | null> {
	// Get player active objects for energy changes
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);

	// Score
	const score = await applyOutcomeScore(possibilityOutcome.outcome[1], possibilityOutcome.time, player, response);

	// Money
	const money = await applyOutcomeMoney(possibilityOutcome.outcome[1], possibilityOutcome.time, player, response);

	// Health
	const health = await applyOutcomeHealth(possibilityOutcome.outcome[1], player, response);

	// Energy
	const energy = applyOutcomeEnergy(possibilityOutcome.outcome[1], player, playerActiveObjects);

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

	// Give pet
	await applyOutcomeGivePet(possibilityOutcome.outcome[1], player, response);

	// Next event
	applyOutcomeNextEvent(possibilityOutcome.outcome[1], player);

	// Oneshot
	await applyOutcomeOneshot(possibilityOutcome.outcome[1], player, response);

	// Forced link
	return getNextMapLink(possibilityOutcome.outcome[1], player);
}

export interface PossibilityOutcome {

	condition?: PossibilityOutcomeCondition;

	/**
	 * Time lost for the lost time effect
	 */
	lostTime?: number;

	/**
	 * Health lost or won
	 */
	health?: number;

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

	givePet?: { petIds: number[] };

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
