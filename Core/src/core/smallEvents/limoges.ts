import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { ReactionCollectorLimoges } from "../../../../Lib/src/packets/interaction/ReactionCollectorLimoges";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	SmallEventLimogesPacket,
	SmallEventLimogesPenaltyType
} from "../../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import Player from "../database/game/models/Player";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";

const PENALTY_TYPES: SmallEventLimogesPenaltyType[] = [
	SmallEventLimogesPenaltyType.HEALTH,
	SmallEventLimogesPenaltyType.MONEY,
	SmallEventLimogesPenaltyType.TIME
];

type Range = {
	MIN: number;
	MAX: number;
};

type LimogesQuestion = {
	id: string;
	shouldAccept: boolean;
};

type LimogesProperties = {
	questions: LimogesQuestion[];
	reward: {
		experience: Range;
		score: Range;
	};
	penalty: {
		health: Range;
		money: Range;
		time: Range;
	};
};

function getRandomQuestion(properties: LimogesProperties): LimogesQuestion {
	return RandomUtils.crowniclesRandom.pick(properties.questions);
}

function createCollector(question: LimogesQuestion): ReactionCollectorLimoges {
	return new ReactionCollectorLimoges(question.id);
}

async function applyFavorableOutcome(
	player: Player,
	response: CrowniclesPacket[],
	properties: LimogesProperties,
	playerActiveObjects: PlayerActiveObjects
): Promise<Required<SmallEventLimogesPacket>["reward"]> {
	const experience = RandomUtils.rangedInt(properties.reward.experience);
	const score = RandomUtils.rangedInt(properties.reward.score);

	await player.addExperience({
		amount: experience,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	}, playerActiveObjects);
	await player.addScore({
		amount: score,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
	await player.save();

	return {
		experience,
		score
	};
}


async function applyUnfavorableOutcome(
	player: Player,
	response: CrowniclesPacket[],
	properties: LimogesProperties,
	playerActiveObjects: PlayerActiveObjects
): Promise<Required<SmallEventLimogesPacket>["penalty"]> {
	const filteredPenaltyTypes = PENALTY_TYPES.filter(type => {
		if (type !== SmallEventLimogesPenaltyType.MONEY) {
			return true;
		}

		// Avoid selecting a money penalty when the player cannot afford the maximum loss.
		return (player.money ?? 0) >= properties.penalty.money.MAX;
	});
	const penaltyPool = filteredPenaltyTypes.length > 0
		? filteredPenaltyTypes
		: PENALTY_TYPES.filter(type => type !== SmallEventLimogesPenaltyType.MONEY);
	const penaltyType = RandomUtils.crowniclesRandom.pick(
		penaltyPool.length > 0 ? penaltyPool : PENALTY_TYPES
	);
	let amount = 0;

	switch (penaltyType) {
		case SmallEventLimogesPenaltyType.HEALTH: {
			amount = RandomUtils.rangedInt(properties.penalty.health);
			await player.addHealth(-amount, response, NumberChangeReason.SMALL_EVENT, playerActiveObjects);
			await player.killIfNeeded(response, NumberChangeReason.SMALL_EVENT);
			await player.save();
			break;
		}
		case SmallEventLimogesPenaltyType.MONEY: {
			amount = RandomUtils.rangedInt(properties.penalty.money);
			await player.addMoney({
				amount: -amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			await player.save();
			break;
		}
		case SmallEventLimogesPenaltyType.TIME: {
			amount = RandomUtils.rangedInt(properties.penalty.time);
			await TravelTime.applyEffect(
				player,
				Effect.OCCUPIED,
				amount,
				new Date(),
				NumberChangeReason.SMALL_EVENT
			);
			break;
		}
		default:
			break;
	}

	return {
		type: penaltyType,
		amount
	};
}

function getEndCallback(
	player: Player,
	question: LimogesQuestion,
	properties: LimogesProperties,
	playerActiveObjects: PlayerActiveObjects
): EndCallback {
	return async (collector, response): Promise<void> => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.LIMOGES_SMALL_EVENT);

		const reaction = collector.getFirstReaction();
		const playerAccepted = reaction?.reaction.type === ReactionCollectorAcceptReaction.name;
		const hasAnswered = Boolean(reaction);
		const isFavorable = hasAnswered && playerAccepted === question.shouldAccept;
		const packet: SmallEventLimogesPacket = {
			questionId: question.id,
			shouldHaveAccepted: question.shouldAccept,
			isSuccess: isFavorable
		};

		if (isFavorable) {
			packet.reward = await applyFavorableOutcome(player, response, properties, playerActiveObjects);
		}
		else {
			packet.penalty = await applyUnfavorableOutcome(player, response, properties, playerActiveObjects);
		}

		response.push(makePacket(SmallEventLimogesPacket, packet));
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,

	executeSmallEvent(response, player, context, playerActiveObjects): void {
		const properties = SmallEventDataController.instance.getById("limoges")
			.getProperties<LimogesProperties>();
		const question = getRandomQuestion(properties);
		const collector = createCollector(question);
		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			getEndCallback(player, question, properties, playerActiveObjects)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.LIMOGES_SMALL_EVENT)
			.build();

		response.push(packet);
	}
};
