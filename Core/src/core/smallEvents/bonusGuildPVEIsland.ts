/* @lockInherited — player write paths run under loadAndExecuteSmallEvents withLockedPlayerAndMissions; guild writes use Guild.withLocked. */
import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	SmallEventBonusGuildPVEIslandOutcomeSurrounding,
	SmallEventBonusGuildPVEIslandEmote,
	SmallEventBonusGuildPVEIslandPacket,
	SmallEventBonusGuildPVEIslandResultType
} from "../../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Maps } from "../maps/Maps";
import Player from "../database/game/models/Player";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Guild } from "../database/game/models/Guild";
import { LockedRowNotFoundError } from "../../../../Lib/src/locks/withLockedEntities";

enum Outcome {
	EXPERIENCE = "experience",
	MONEY = "money",
	LIFE = "life",
	EXP_OR_POINTS_GUILD = "expOrPointsGuild"
}

type BonusGuildPVEIslandProperties = {
	events: {
		[key in SmallEventBonusGuildPVEIslandResultType]: {
			withGuild: Outcome;
			solo: Outcome;
		};
	}[];
	ranges: {
		[key in Outcome]: {
			min: number;
			max: number;
		}
	};
};

async function hasEnoughMemberOnPVEIsland(player: Player): Promise<boolean> {
	return (await Maps.getGuildMembersOnPveIsland(player)).length >= RandomUtils.randInt(1, 4);
}

type RewardResult = {
	amount: number;
	isExperienceGain: boolean;
};

type Winnings = RewardResult & {
	emoteKey: SmallEventBonusGuildPVEIslandEmote;
};

function getEmoteKey(rewardKind: Outcome, isExperienceGain: boolean): SmallEventBonusGuildPVEIslandEmote {
	switch (rewardKind) {
		case Outcome.EXPERIENCE:
			return SmallEventBonusGuildPVEIslandEmote.EXPERIENCE;
		case Outcome.MONEY:
			return SmallEventBonusGuildPVEIslandEmote.LOST_MONEY;
		case Outcome.LIFE:
			return SmallEventBonusGuildPVEIslandEmote.LOST_HEALTH;
		case Outcome.EXP_OR_POINTS_GUILD:
			return isExperienceGain
				? SmallEventBonusGuildPVEIslandEmote.EXPERIENCE
				: SmallEventBonusGuildPVEIslandEmote.GUILD_POINTS;
		default: {
			const exhaustiveRewardKind: never = rewardKind;
			throw new Error(`Unknown PVE island reward kind: ${exhaustiveRewardKind}`);
		}
	}
}

async function manageGuildReward(response: CrowniclesPacket[], player: Player, result: RewardResult): Promise<void> {
	if (!player.guildId) {
		return;
	}

	try {
		await Guild.withLocked(player.guildId, async guild => {
			if (guild.isAtMaxLevel()) {
				result.isExperienceGain = false;
			}
			const params = {
				amount: result.amount, response, reason: NumberChangeReason.SMALL_EVENT
			};
			if (result.isExperienceGain) {
				await guild.addExperience(params);
			}
			else {
				await guild.addScore(params);
			}
			await guild.save();
		});
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			return;
		}
		throw error;
	}
}

async function manageClassicReward(response: CrowniclesPacket[], player: Player, result: RewardResult, rewardKind: Outcome): Promise<void> {
	const reason = NumberChangeReason.SMALL_EVENT;
	switch (rewardKind) {
		case Outcome.MONEY:
			await player.addMoney({
				amount: -result.amount,
				response,
				reason
			});
			break;
		case Outcome.LIFE:
			await player.addHealth({
				amount: -result.amount,
				response,
				reason
			});
			break;
		case Outcome.EXPERIENCE:
			await player.addExperience({
				amount: result.amount,
				response,
				reason
			});
			break;
		default:
			break;
	}
}

async function applyPossibility(
	player: Player,
	response: CrowniclesPacket[],
	issue: SmallEventBonusGuildPVEIslandResultType,
	rewardKind: Outcome
): Promise<Winnings> {
	const rewardRange = SmallEventDataController.instance.getById("bonusGuildPVEIsland")!
		.getProperties<BonusGuildPVEIslandProperties>().ranges[rewardKind];
	const isExperienceGain = rewardKind === Outcome.EXP_OR_POINTS_GUILD && RandomUtils.crowniclesRandom.bool();
	const result = {
		amount: RandomUtils.randInt(rewardRange.min, rewardRange.max),
		isExperienceGain
	};
	if (issue === SmallEventBonusGuildPVEIslandResultType.SUCCESS && player.hasAGuild()) {
		await manageGuildReward(response, player, result);
	}
	else {
		await manageClassicReward(response, player, result, rewardKind);
		await player.save();
	}
	return {
		...result,
		emoteKey: getEmoteKey(rewardKind, result.isExperienceGain)
	};
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnPveIsland,
	executeSmallEvent: async (response, player): Promise<void> => {
		const bonusGuildPVEIslandProperties = SmallEventDataController.instance.getById("bonusGuildPVEIsland")!
			.getProperties<BonusGuildPVEIslandProperties>();
		const event: number = RandomUtils.randInt(0, bonusGuildPVEIslandProperties.events.length);
		const probabilities = RandomUtils.randInt(0, 100);
		const enoughMembers = await hasEnoughMemberOnPVEIsland(player);
		const issue: SmallEventBonusGuildPVEIslandResultType = probabilities < SmallEventConstants.BONUS_GUILD_PVE_ISLANDS.PROBABILITIES.SUCCESS || enoughMembers
			? SmallEventBonusGuildPVEIslandResultType.SUCCESS
			: probabilities < SmallEventConstants.BONUS_GUILD_PVE_ISLANDS.PROBABILITIES.ESCAPE
				? SmallEventBonusGuildPVEIslandResultType.ESCAPE
				: SmallEventBonusGuildPVEIslandResultType.LOSE;

		response.push(makePacket(SmallEventBonusGuildPVEIslandPacket, {
			event,
			result: issue,
			surrounding: player.hasAGuild()
				? !enoughMembers && issue === SmallEventBonusGuildPVEIslandResultType.SUCCESS
					? SmallEventBonusGuildPVEIslandOutcomeSurrounding.SOLO_WITH_GUILD
					: SmallEventBonusGuildPVEIslandOutcomeSurrounding.WITH_GUILD
				: SmallEventBonusGuildPVEIslandOutcomeSurrounding.SOLO,
			...issue === SmallEventBonusGuildPVEIslandResultType.ESCAPE
				? {
					amount: 0,
					isExperienceGain: false
				}
				: await applyPossibility(player, response, issue, bonusGuildPVEIslandProperties.events[event][issue][
					player.hasAGuild()
						? SmallEventBonusGuildPVEIslandOutcomeSurrounding.WITH_GUILD
						: SmallEventBonusGuildPVEIslandOutcomeSurrounding.SOLO
				])
		}));
	}
};
