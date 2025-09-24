import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import Player from "../database/game/models/Player";
import { Maps } from "../maps/Maps";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorLottery,
	ReactionCollectorLotteryHardReaction,
	ReactionCollectorLotteryMediumReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventLotteryLosePacket,
	SmallEventLotteryNoAnswerPacket,
	SmallEventLotteryPoorPacket,
	SmallEventLotteryWinPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	Guild, Guilds
} from "../database/game/models/Guild";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerActiveObjects } from "../database/game/models/PlayerActiveObjects";

type LotteryProperties = {
	successRate: {
		[lotteryLevel in LotteryLevelKey]: number
	};
	coefficients: {
		[lotteryLevel in LotteryLevelKey]: number
	};
	lostTime: number;
};

type LotteryLevelKey = "hard" | "medium" | "easy";

async function effectIfGoodRisk(levelKey: LotteryLevelKey, player: Player, dataLottery: LotteryProperties): Promise<number> {
	if (levelKey !== "easy") {
		await TravelTime.applyEffect(
			player,
			Effect.OCCUPIED,
			dataLottery.lostTime,
			new Date(),
			NumberChangeReason.SMALL_EVENT
		);
		return dataLottery.lostTime;
	}

	return 0;
}

type WhoToGive = {
	player: Player;
	playerActiveObjects: PlayerActiveObjects;
	guild: Guild;
};

type RewardParams = {
	coefficient: number;
	lostTime: number;
	levelKey: LotteryLevelKey;
};

async function giveRewardToPlayer(
	response: CrowniclesPacket[],
	{
		player,
		playerActiveObjects,
		guild
	}: WhoToGive,
	rewardType: string,
	{
		coefficient,
		lostTime,
		levelKey
	}: RewardParams
): Promise<void> {
	switch (rewardType) {
		case SmallEventConstants.LOTTERY.REWARD_TYPES.XP:
			await player.addExperience({
				amount: SmallEventConstants.LOTTERY.REWARDS.EXPERIENCE * coefficient,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			}, playerActiveObjects);
			response.push(makePacket(SmallEventLotteryWinPacket, {
				winAmount: SmallEventConstants.LOTTERY.REWARDS.EXPERIENCE * coefficient,
				lostTime,
				level: levelKey,
				winReward: "xp"
			}));
			break;
		case SmallEventConstants.LOTTERY.REWARD_TYPES.MONEY:
			await player.addMoney({
				amount: SmallEventConstants.LOTTERY.REWARDS.MONEY * coefficient,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			response.push(makePacket(SmallEventLotteryWinPacket, {
				winAmount: SmallEventConstants.LOTTERY.REWARDS.MONEY * coefficient,
				lostTime,
				level: levelKey,
				winReward: "money"
			}));
			break;
		case SmallEventConstants.LOTTERY.REWARD_TYPES.GUILD_XP:
			await guild.addExperience(SmallEventConstants.LOTTERY.REWARDS.GUILD_EXPERIENCE * coefficient, response, NumberChangeReason.SMALL_EVENT);
			await guild.save();
			response.push(makePacket(SmallEventLotteryWinPacket, {
				winAmount: SmallEventConstants.LOTTERY.REWARDS.GUILD_EXPERIENCE * coefficient,
				lostTime,
				level: levelKey,
				winReward: "guildXp"
			}));
			break;
		case SmallEventConstants.LOTTERY.REWARD_TYPES.POINTS:
			await player.addScore({
				amount: SmallEventConstants.LOTTERY.REWARDS.POINTS * coefficient,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			response.push(makePacket(SmallEventLotteryWinPacket, {
				winAmount: SmallEventConstants.LOTTERY.REWARDS.POINTS * coefficient,
				lostTime,
				level: levelKey,
				winReward: "points"
			}));
			break;
		default:
			throw new Error("lottery reward type not found");
	}
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,

	executeSmallEvent(response, player, context, playerActiveObjects): void {
		const dataLottery = SmallEventDataController.instance.getById("lottery")
			.getProperties<LotteryProperties>();

		const collector = new ReactionCollectorLottery();

		const endCallback: EndCallback = async (collector, response) => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.LOTTERY);

			const reaction = collector.getFirstReaction();

			if (reaction === null) {
				response.push(makePacket(SmallEventLotteryNoAnswerPacket, {}));
			}
			else {
				let levelKey: LotteryLevelKey;

				if (reaction.reaction.type === ReactionCollectorLotteryHardReaction.name) {
					levelKey = "hard";
				}
				else if (reaction.reaction.type === ReactionCollectorLotteryMediumReaction.name) {
					levelKey = "medium";
				}
				else {
					levelKey = "easy";
				}

				if (player.money < SmallEventConstants.LOTTERY.MONEY_MALUS && levelKey === "hard") {
					response.push(makePacket(SmallEventLotteryPoorPacket, {}));
					return;
				}

				let rewardTypes = Object.values(SmallEventConstants.LOTTERY.REWARD_TYPES);
				const guild = await Guilds.ofPlayer(player);
				if (!guild || guild.isAtMaxLevel()) {
					rewardTypes = rewardTypes.filter(r => r !== SmallEventConstants.LOTTERY.REWARD_TYPES.GUILD_XP);
				}

				const lostTime = await effectIfGoodRisk(levelKey, player, dataLottery);

				const rewardType = RandomUtils.crowniclesRandom.pick(rewardTypes);

				if (RandomUtils.crowniclesRandom.bool(dataLottery.successRate[levelKey]) && (guild || rewardType !== SmallEventConstants.LOTTERY.REWARD_TYPES.GUILD_XP)) {
					const coefficient = dataLottery.coefficients[levelKey];
					await giveRewardToPlayer(response, {
						player,
						playerActiveObjects,
						guild
					}, rewardType, {
						coefficient,
						lostTime,
						levelKey
					});

					await player.save();
				}
				else if (levelKey === "hard" && RandomUtils.crowniclesRandom.bool(dataLottery.successRate[levelKey])) {
					await player.addMoney({
						amount: -SmallEventConstants.LOTTERY.MONEY_MALUS,
						response,
						reason: NumberChangeReason.SMALL_EVENT
					});
					await player.save();
					response.push(makePacket(SmallEventLotteryLosePacket, {
						moneyLost: Math.abs(SmallEventConstants.LOTTERY.MONEY_MALUS),
						lostTime,
						level: levelKey
					}));
				}
				else {
					response.push(makePacket(SmallEventLotteryLosePacket, {
						moneyLost: 0,
						lostTime,
						level: levelKey
					}));
				}
			}
		};

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.LOTTERY)
			.build();

		response.push(packet);
	}
};
