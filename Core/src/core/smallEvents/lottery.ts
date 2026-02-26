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
	ReactionCollectorLottery, ReactionCollectorLotteryHardReaction, ReactionCollectorLotteryMediumReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventLotteryLosePacket, SmallEventLotteryNoAnswerPacket, SmallEventLotteryPoorPacket, SmallEventLotteryWinPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { BlessingManager } from "../blessings/BlessingManager";
import {
	Guild, Guilds
} from "../database/game/models/Guild";
import { TravelTime } from "../maps/TravelTime";
import { Effect } from "../../../../Lib/src/types/Effect";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

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
	guild: Guild;
};

type RewardParams = {
	coefficient: number;
	lostTime: number;
	levelKey: LotteryLevelKey;
};

type LotteryRewardType = typeof SmallEventConstants.LOTTERY.REWARD_TYPES[keyof typeof SmallEventConstants.LOTTERY.REWARD_TYPES];

function pushWinPacket(response: CrowniclesPacket[], reward: {
	amount: number; type: LotteryRewardType;
}, lostTime: number, levelKey: LotteryLevelKey): void {
	response.push(makePacket(SmallEventLotteryWinPacket, {
		winAmount: reward.amount, lostTime, level: levelKey, winReward: reward.type
	}));
}

async function giveRewardToPlayer(
	response: CrowniclesPacket[],
	{
		player,
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
			});
			pushWinPacket(response, {
				amount: SmallEventConstants.LOTTERY.REWARDS.EXPERIENCE * coefficient, type: SmallEventConstants.LOTTERY.REWARD_TYPES.XP
			}, lostTime, levelKey);
			break;
		case SmallEventConstants.LOTTERY.REWARD_TYPES.MONEY:
			await player.addMoney({
				amount: SmallEventConstants.LOTTERY.REWARDS.MONEY * coefficient,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			pushWinPacket(response, {
				amount: BlessingManager.getInstance().applyMoneyBlessing(SmallEventConstants.LOTTERY.REWARDS.MONEY * coefficient), type: SmallEventConstants.LOTTERY.REWARD_TYPES.MONEY
			}, lostTime, levelKey);
			break;
		case SmallEventConstants.LOTTERY.REWARD_TYPES.GUILD_XP:
			await guild.addExperience({
				amount: SmallEventConstants.LOTTERY.REWARDS.GUILD_EXPERIENCE * coefficient, response, reason: NumberChangeReason.SMALL_EVENT
			});
			await guild.save();
			pushWinPacket(response, {
				amount: SmallEventConstants.LOTTERY.REWARDS.GUILD_EXPERIENCE * coefficient, type: SmallEventConstants.LOTTERY.REWARD_TYPES.GUILD_XP
			}, lostTime, levelKey);
			break;
		case SmallEventConstants.LOTTERY.REWARD_TYPES.POINTS: {
			const scoreParameters = {
				amount: SmallEventConstants.LOTTERY.REWARDS.POINTS * coefficient,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			};
			await player.addScore(scoreParameters);
			pushWinPacket(response, {
				amount: scoreParameters.amount, type: SmallEventConstants.LOTTERY.REWARD_TYPES.POINTS
			}, lostTime, levelKey);
			break;
		}
		default:
			throw new Error("lottery reward type not found");
	}
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,

	executeSmallEvent(response, player, context): void {
		const dataLottery = SmallEventDataController.instance.getById("lottery")!
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

				const rewardType = RandomUtils.crowniclesRandom.pick(rewardTypes)!;

				if (RandomUtils.crowniclesRandom.bool(dataLottery.successRate[levelKey]) && (guild || rewardType !== SmallEventConstants.LOTTERY.REWARD_TYPES.GUILD_XP)) {
					const coefficient = dataLottery.coefficients[levelKey];
					await giveRewardToPlayer(response, {
						player,
						guild: guild!
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
