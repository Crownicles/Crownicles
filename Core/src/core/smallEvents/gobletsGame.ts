import {SmallEventFuncs} from "../../data/SmallEvent";
import {MapConstants} from "../../../../Lib/src/constants/MapConstants";
import {Maps} from "../maps/Maps";
import {BlockingConstants} from "../../../../Lib/src/constants/BlockingConstants";
import Player from "../database/game/models/Player";
import {SmallEventConstants} from "../../../../Lib/src/constants/SmallEventConstants";
import {RandomUtils} from "../../../../Lib/src/utils/RandomUtils";
import {BlockingUtils} from "../utils/BlockingUtils";
import {DraftBotPacket, makePacket} from "../../../../Lib/src/packets/DraftBotPacket";
import {NumberChangeReason} from "../../../../Lib/src/constants/LogsConstants";
import {TravelTime} from "../maps/TravelTime";
import {
	SmallEventGobletsGameMalus,
	SmallEventGobletsGamePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import {EndCallback, ReactionCollectorInstance} from "../utils/ReactionsCollector";
import {
	ReactionCollectorGobletsGame,
	ReactionCollectorGobletsGameReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorGobletsGame";
import {ReactionCollectorReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {Effect} from "../../../../Lib/src/types/Effect";

function computeLostValue(level: number, modifiers: {
	LEVEL_MULTIPLIER: number,
	BASE: number,
	VARIATION: number
}): number {
	return Math.round(level * modifiers.LEVEL_MULTIPLIER) + modifiers.BASE + RandomUtils.variationInt(modifiers.VARIATION);
}

async function applyMalus(response: DraftBotPacket[], player: Player, reaction: ReactionCollectorReaction): Promise<void> {
	const malus = !reaction ? SmallEventGobletsGameMalus.END : RandomUtils.draftbotRandom.pick(Object.values(SmallEventGobletsGameMalus).filter(m => m !== SmallEventGobletsGameMalus.END));
	const packet = makePacket(SmallEventGobletsGamePacket, {
		malus,
		goblet: (reaction as { data: ReactionCollectorGobletsGameReaction })?.data.id,
		value: 0
	});
	switch (malus) {
	case SmallEventGobletsGameMalus.LIFE:
	case SmallEventGobletsGameMalus.END:
		packet.value = computeLostValue(player.level, SmallEventConstants.GOBLETS_GAME.HEALTH_LOST);
		await player.addHealth(-packet.value, response, NumberChangeReason.SMALL_EVENT);
		await player.killIfNeeded(response, NumberChangeReason.SMALL_EVENT);
		break;
	case SmallEventGobletsGameMalus.TIME:
		packet.value = computeLostValue(player.level, SmallEventConstants.GOBLETS_GAME.TIME_LOST);
		await TravelTime.applyEffect(player, Effect.OCCUPIED, packet.value, new Date(), NumberChangeReason.SMALL_EVENT);
		break;
	case SmallEventGobletsGameMalus.NOTHING:
		break;
	default:
		throw new Error("reward type not found");
	}
	await player.save();
	response.push(packet);
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: (player) => {
		const destination = player.getDestination();
		const origin = player.getPreviousMap();
		return Maps.isOnContinent(player) &&
			![destination.id, origin.id].some(mapId =>
				[MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS, MapConstants.LOCATIONS_IDS.MARSHY_ROAD].includes(mapId));
	},
	executeSmallEvent: (response, player, context) => {
		const collector = new ReactionCollectorGobletsGame();

		const endCallback: EndCallback = async (collector, response) => {
			await applyMalus(response, player, collector.getFirstReaction()?.reaction);
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