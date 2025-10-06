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
	SmallEventLimogesOutcome,
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

const PENALTY_TYPES: SmallEventLimogesPenaltyType[] = [
	"health",
	"money",
	"time"
];

type Range = {
	MIN: number;
	MAX: number;
};

type FavorableAnswer = "accept" | "refuse";

type LimogesQuestion = {
	id: string;
	favorableAnswer: FavorableAnswer;
};

type LimogesProperties = {
	factKeys: string[];
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

async function applyFavorableOutcome(
	player: Player,
	response: CrowniclesPacket[],
	properties: LimogesProperties
): Promise<SmallEventLimogesPacket["reward"]> {
	const experience = RandomUtils.rangedInt(properties.reward.experience);
	const score = RandomUtils.rangedInt(properties.reward.score);

	await player.addExperience({
		amount: experience,
		response,
		reason: NumberChangeReason.SMALL_EVENT
	});
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
	properties: LimogesProperties
): Promise<Required<SmallEventLimogesPacket>["penalty"]> {
	const filteredPenaltyTypes = PENALTY_TYPES.filter((type) => {
		if (type !== "money") {
			return true;
		}

		// Avoid selecting a money penalty when the player cannot afford the maximum loss.
		return (player.money ?? 0) >= properties.penalty.money.MAX;
	});
	const penaltyPool = filteredPenaltyTypes.length > 0
		? filteredPenaltyTypes
		: PENALTY_TYPES.filter((type) => type !== "money");
	const penaltyType = RandomUtils.crowniclesRandom.pick(
		penaltyPool.length > 0 ? penaltyPool : PENALTY_TYPES
	);
	let amount = 0;

	switch (penaltyType) {
		case "health": {
			amount = RandomUtils.rangedInt(properties.penalty.health);
			await player.addHealth(-amount, response, NumberChangeReason.SMALL_EVENT);
			await player.killIfNeeded(response, NumberChangeReason.SMALL_EVENT);
			await player.save();
			break;
		}
		case "money": {
			amount = RandomUtils.rangedInt(properties.penalty.money);
			await player.addMoney({
				amount: -amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			await player.save();
			break;
		}
		default: {
			amount = RandomUtils.rangedInt(properties.penalty.time);
			await TravelTime.applyEffect(
				player,
				Effect.OCCUPIED,
				amount,
				new Date(),
				NumberChangeReason.SMALL_EVENT
			);
		}
	}

	return {
		type: penaltyType,
		amount
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,

	executeSmallEvent(response, player, context): void {
		const properties = SmallEventDataController.instance.getById("limoges")
			.getProperties<LimogesProperties>();
		const factKey = RandomUtils.crowniclesRandom.pick(properties.factKeys);
		const question = RandomUtils.crowniclesRandom.pick(properties.questions);

		const collector = new ReactionCollectorLimoges(factKey, question.id);

		const endCallback: EndCallback = async (collector, packets): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.LIMOGES_SMALL_EVENT);

			const reaction = collector.getFirstReaction();
			const playerAnswer: FavorableAnswer | "none" = reaction
				? reaction.reaction.type === ReactionCollectorAcceptReaction.name ? "accept" : "refuse"
				: "none";
			const isFavorable = playerAnswer !== "none" && playerAnswer === question.favorableAnswer;
			const packet: SmallEventLimogesPacket = {
				factKey,
				questionId: question.id,
				expectedAnswer: question.favorableAnswer,
				outcome: isFavorable ? SmallEventLimogesOutcome.SUCCESS : SmallEventLimogesOutcome.FAILURE
			};

			if (isFavorable) {
				packet.reward = await applyFavorableOutcome(player, packets, properties);
			}
			else {
				packet.penalty = await applyUnfavorableOutcome(player, packets, properties);
			}

			packets.push(makePacket(SmallEventLimogesPacket, packet));
		};

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.LIMOGES_SMALL_EVENT)
			.build();

		response.push(packet);
	}
};
