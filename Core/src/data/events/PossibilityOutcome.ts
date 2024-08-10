import Player from "../../core/database/game/models/Player";
import {NumberChangeReason} from "../../../../Lib/src/constants/LogsConstants";
import {generateRandomItem, giveItemToPlayer} from "../../core/utils/ItemUtils";
import {RandomUtils} from "../../../../Lib/src/utils/RandomUtils";
import {Constants} from "../../../../Lib/src/constants/Constants";
import {PlayerSmallEvents} from "../../core/database/game/models/PlayerSmallEvent";
import {Maps} from "../../core/maps/Maps";
import {PlayerMissionsInfos} from "../../core/database/game/models/PlayerMissionsInfo";
import {InventorySlots} from "../../core/database/game/models/InventorySlot";
import {PetEntities} from "../../core/database/game/models/PetEntity";
import {CommandReportBigEventResultRes} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {DraftBotPacket, makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {ItemConstants} from "../../../../Lib/src/constants/ItemConstants";
import {MapLink, MapLinkDataController} from "../MapLink";
import {Effect} from "../../../../Lib/src/enums/Effect";

async function applyOutcomeScore(outcome: PossibilityOutcome, time: number, player: Player, response: DraftBotPacket[]): Promise<number> {
	const scoreChange = time +
		RandomUtils.draftbotRandom.integer(0, time / Constants.REPORT.BONUS_POINT_TIME_DIVIDER) +
		await PlayerSmallEvents.calculateCurrentScore(player) +
		(outcome.bonusPoints ?? 0);
	await player.addScore({
		response,
		amount: scoreChange,
		reason: NumberChangeReason.BIG_EVENT
	});
	return scoreChange;
}

async function applyOutcomeExperience(outcome: PossibilityOutcome, player: Player, response: DraftBotPacket[]): Promise<number> {
	let experienceChange = 150 +
		(outcome.health > 0 ? 200 : 0) +
		(outcome.randomItem ? 300 : 0) +
		(outcome.money > 0 ? 100 : 0);
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
	name: string,
	time: number
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

async function applyOutcomeHealth(outcome: PossibilityOutcome, player: Player, response: DraftBotPacket[]): Promise<number> {
	if (outcome.health && outcome.health !== 0) {
		await player.addHealth(outcome.health, response, NumberChangeReason.BIG_EVENT);
		return outcome.health;
	}
	return 0;
}

async function applyOutcomeMoney(outcome: PossibilityOutcome, time: number, player: Player, response: DraftBotPacket[]): Promise<number> {
	let moneyChange = (outcome.money ?? 0) + Math.round(time / 10 + RandomUtils.draftbotRandom.integer(0, time / 10 + player.level / 5 - 1));
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

async function applyOutcomeRandomItem(outcome: PossibilityOutcome, player: Player, context: PacketContext, response: DraftBotPacket[]): Promise<void> {
	if (outcome.randomItem) {
		const minRarity = outcome.randomItem.rarity?.min ?? ItemConstants.RARITY.COMMON;
		const maxRarity = outcome.randomItem.rarity?.max ?? ItemConstants.RARITY.MYTHICAL;
		const category = outcome.randomItem.category ?? null;

		const item = generateRandomItem(category, minRarity, maxRarity);
		const inventorySlots = await InventorySlots.getOfPlayer(player.id);
		await giveItemToPlayer(player, item, context, response, inventorySlots);
	}
}

async function applyOutcomeRandomPet(outcome: PossibilityOutcome, player: Player, response: DraftBotPacket[]): Promise<void> {
	if (outcome.randomPet) {
		const minRarity = outcome.randomPet.rarity?.min ?? 1;
		const maxRarity = outcome.randomPet.rarity?.max ?? 5;

		const pet = PetEntities.generateRandomPetEntityNotGuild(minRarity, maxRarity);
		await pet.giveToPlayer(player, response);
	}
}

async function applyOutcomeOneshot(outcome: PossibilityOutcome, player: Player, response: DraftBotPacket[]): Promise<void> {
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

		return RandomUtils.draftbotRandom.pick(
			MapLinkDataController.instance.getMapLinksWithMapTypes(
				allowedMapTypes,
				player.getDestinationId(),
				!outcome.mapTypesDestination ? player.getPreviousMapId() : null
			)
		);
	}

	return null;
}

/**
 * Apply a possibility outcome to a player
 * @param outcome
 * @param player
 * @param time
 * @param context
 * @param response
 */
export async function applyPossibilityOutcome(eventId: number, possibilityName: string, outcome: [string, PossibilityOutcome], player: Player, time: number, context: PacketContext, response: DraftBotPacket[]): Promise<MapLink> {
	// Score
	const score = await applyOutcomeScore(outcome[1], time, player, response);

	// Money
	const money = await applyOutcomeMoney(outcome[1], time, player, response);

	// Health
	const health = await applyOutcomeHealth(outcome[1], player, response);

	// Energy
	const energy = applyOutcomeEnergy(outcome[1], player);

	// Gems
	const gems = await applyOutcomeGems(outcome[1], player);

	// Experience
	const experience = await applyOutcomeExperience(outcome[1], player, response);

	// Effect + lost time
	const effect = await applyOutcomeEffect(outcome[1], player);

	const packet = makePacket(CommandReportBigEventResultRes, {
		eventId,
		possibilityId: possibilityName,
		outcomeId: outcome[0],
		score,
		money,
		health,
		energy,
		gems,
		experience,
		effect,
		oneshot: outcome[1].oneshot ?? false
	});

	response.push(packet);

	// Random item
	await applyOutcomeRandomItem(outcome[1], player, context, response);

	// Random pet
	await applyOutcomeRandomPet(outcome[1], player, response);

	// Next event
	applyOutcomeNextEvent(outcome[1], player);

	// Oneshot
	await applyOutcomeOneshot(outcome[1], player, response);

	// Forced link
	return getNextMapLink(outcome[1], player);
}

export interface PossibilityOutcome {
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
		}
	};

	/**
	 * Give a random pet
	 */
	randomPet?: {
		rarity?: {
			min?: number;
			max?: number;
		}
	}

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
	tags?: string[]
}