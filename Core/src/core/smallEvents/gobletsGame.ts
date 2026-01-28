import { SmallEventFuncs } from "../../data/SmallEvent";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { Maps } from "../maps/Maps";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import Player from "../database/game/models/Player";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { BlockingUtils } from "../utils/BlockingUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import {
	SmallEventGobletsGameMalus, SmallEventGobletsGamePacket, SmallEventGobletsGameStrategy
} from "../../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import {
	ReactionCollectorGobletsGame,
	ReactionCollectorGobletsGameReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorGobletsGame";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";

/**
 * Get strategy config based on the chosen strategy
 */
function getStrategyConfig(strategy: SmallEventGobletsGameStrategy): {
	NOTHING_CHANCE: number;
	ITEM_CHANCE: number;
	MALUS_MULTIPLIER: number;
	ITEM_RARITIES?: number[];
} {
	switch (strategy) {
		case SmallEventGobletsGameStrategy.CLASSIC:
			return SmallEventConstants.GOBLETS_GAME.STRATEGIES.CLASSIC;
		case SmallEventGobletsGameStrategy.RISKY:
			return SmallEventConstants.GOBLETS_GAME.STRATEGIES.RISKY;
		case SmallEventGobletsGameStrategy.SAFE:
			return SmallEventConstants.GOBLETS_GAME.STRATEGIES.SAFE;
		case SmallEventGobletsGameStrategy.GAMBLER:
			return SmallEventConstants.GOBLETS_GAME.STRATEGIES.GAMBLER;
		default:
			return SmallEventConstants.GOBLETS_GAME.STRATEGIES.CLASSIC;
	}
}

function computeLostValue(level: number, modifiers: {
	LEVEL_MULTIPLIER: number;
	BASE: number;
	VARIATION: number;
}, multiplier: number): number {
	const baseValue = Math.round(level * modifiers.LEVEL_MULTIPLIER) + modifiers.BASE + RandomUtils.variationInt(modifiers.VARIATION);
	return Math.round(baseValue * multiplier);
}

async function manageHealthLost(
	packet: SmallEventGobletsGamePacket,
	player: Player,
	malus: SmallEventGobletsGameMalus.LIFE | SmallEventGobletsGameMalus.END,
	response: CrowniclesPacket[],
	malusMultiplier: number
): Promise<void> {
	packet.value = computeLostValue(player.level, SmallEventConstants.GOBLETS_GAME.HEALTH_LOST, malusMultiplier);
	if (malus === SmallEventGobletsGameMalus.END) {
		packet.value = Math.round(packet.value * SmallEventConstants.GOBLETS_GAME.HEALTH_LOST.END_INTENSIFIER - SmallEventConstants.GOBLETS_GAME.HEALTH_LOST.END_ADJUSTER);
	}
	await player.addHealth(-packet.value, response, NumberChangeReason.SMALL_EVENT);
	await player.killIfNeeded(response, NumberChangeReason.SMALL_EVENT);
}

/**
 * Determine the outcome based on strategy probabilities
 */
function determineOutcome(strategy: SmallEventGobletsGameStrategy): SmallEventGobletsGameMalus {
	const config = getStrategyConfig(strategy);
	const roll = RandomUtils.crowniclesRandom.realZeroToOneInclusive();

	// Check for nothing first
	if (roll < config.NOTHING_CHANCE) {
		return SmallEventGobletsGameMalus.NOTHING;
	}

	// Check for item (only for RISKY strategy)
	if (config.ITEM_CHANCE > 0 && roll < config.NOTHING_CHANCE + config.ITEM_CHANCE) {
		return SmallEventGobletsGameMalus.ITEM;
	}

	// Otherwise, randomly pick between life and time malus
	return RandomUtils.crowniclesRandom.pick([SmallEventGobletsGameMalus.LIFE, SmallEventGobletsGameMalus.TIME]);
}

async function applyMalus(
	response: CrowniclesPacket[],
	player: Player,
	reaction: { data: ReactionCollectorGobletsGameReaction } | undefined,
	context: PacketContext
): Promise<void> {
	// Get strategy from the chosen goblet reaction
	const strategy = reaction?.data.strategy ?? SmallEventGobletsGameStrategy.CLASSIC;
	const config = getStrategyConfig(strategy);

	const malus = !reaction
		? SmallEventGobletsGameMalus.END
		: determineOutcome(strategy);

	const packet = makePacket(SmallEventGobletsGamePacket, {
		malus,
		goblet: reaction?.data.id ?? "",
		value: 0,
		strategy
	});

	switch (malus) {
		case SmallEventGobletsGameMalus.LIFE:
		case SmallEventGobletsGameMalus.END:
			await manageHealthLost(packet, player, malus, response, config.MALUS_MULTIPLIER);
			break;
		case SmallEventGobletsGameMalus.TIME:
			packet.value = computeLostValue(player.level, SmallEventConstants.GOBLETS_GAME.TIME_LOST, config.MALUS_MULTIPLIER);
			await TravelTime.applyEffect(player, Effect.OCCUPIED, packet.value, new Date(), NumberChangeReason.SMALL_EVENT);
			break;
		case SmallEventGobletsGameMalus.ITEM: {
			// Generate a random item with min rarity depending on player's level
			const minRarity = player.level < SmallEventConstants.GOBLETS_GAME.MIN_LEVEL_FOR_EPIC_ITEM ? ItemRarity.SPECIAL : ItemRarity.EPIC;
			const item = generateRandomItem({
				minRarity,
				maxRarity: ItemRarity.MYTHICAL
			});
			packet.itemId = item.id;
			packet.itemCategory = item.getCategory();
			await giveItemToPlayer(response, context, player, item);
			break;
		}
		case SmallEventGobletsGameMalus.NOTHING:
			break;
		default:
			throw new Error("reward type not found");
	}
	await player.save();
	response.push(packet);
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: player => {
		const destination = player.getDestination();
		const origin = player.getPreviousMap();
		if (!destination || !origin) {
			return false;
		}
		return Maps.isOnContinent(player)
			&& ![destination.id, origin.id].some(mapId =>
				[
					MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS,
					MapConstants.LOCATIONS_IDS.MARSHY_ROAD,
					MapConstants.LOCATIONS_IDS.MOUNT_CELESTRUM
				].includes(mapId));
	},
	executeSmallEvent: (response, player, context) => {
		const collector = new ReactionCollectorGobletsGame();

		const endCallback: EndCallback = async (collector, response) => {
			const firstReaction = collector.getFirstReaction()?.reaction as {
				data: ReactionCollectorGobletsGameReaction;
			} | undefined;
			await applyMalus(response, player, firstReaction, context);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GOBLET_CHOOSE);
		};

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.GOBLET_CHOOSE)
			.build();

		response.push(packet);
	}
};
