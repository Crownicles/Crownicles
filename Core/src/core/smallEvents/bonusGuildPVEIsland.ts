/* @lockInherited — player write paths run under loadAndExecuteSmallEvents withLockedPlayerAndMissions; guild writes use Guild.withLocked after that transaction commits. */
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
import { runAfterCommit } from "../../../../Lib/src/locks/scheduleAfterCommit";

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

/**
 * Credit the guild reward in its own critical section on the guild row, once the reporter's transaction has committed.
 * Guild members are usually all active on the island at the same time: locking the guild row late from the reporter's
 * transaction failed with ER_CHECKREAD under MariaDB snapshot isolation whenever another member had just updated it (#4924).
 * The packet is already in the response but not sent yet, so it is adjusted if the guild reached its max level meanwhile.
 */
async function manageGuildReward(response: CrowniclesPacket[], guildId: number, packet: SmallEventBonusGuildPVEIslandPacket): Promise<void> {
	try {
		await Guild.withLocked(guildId, async guild => {
			if (guild.isAtMaxLevel() && packet.isExperienceGain) {
				packet.isExperienceGain = false;
				packet.emoteKey = getEmoteKey(Outcome.EXP_OR_POINTS_GUILD, false);
			}
			const params = {
				amount: packet.amount, response, reason: NumberChangeReason.SMALL_EVENT
			};
			if (packet.isExperienceGain) {
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

async function manageClassicReward(response: CrowniclesPacket[], player: Player, amount: number, rewardKind: Outcome): Promise<void> {
	const reason = NumberChangeReason.SMALL_EVENT;
	switch (rewardKind) {
		case Outcome.MONEY:
			await player.addMoney({
				amount: -amount,
				response,
				reason
			});
			break;
		case Outcome.LIFE:
			await player.addHealth({
				amount: -amount,
				response,
				reason
			});
			break;
		case Outcome.EXPERIENCE:
			await player.addExperience({
				amount,
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
	packet: SmallEventBonusGuildPVEIslandPacket,
	rewardKind: Outcome
): Promise<void> {
	const rewardRange = SmallEventDataController.instance.getById("bonusGuildPVEIsland")!
		.getProperties<BonusGuildPVEIslandProperties>().ranges[rewardKind];
	packet.amount = RandomUtils.randInt(rewardRange.min, rewardRange.max);
	packet.isExperienceGain = rewardKind === Outcome.EXP_OR_POINTS_GUILD && RandomUtils.crowniclesRandom.bool();
	packet.emoteKey = getEmoteKey(rewardKind, packet.isExperienceGain);
	if (packet.result === SmallEventBonusGuildPVEIslandResultType.SUCCESS && player.guildId) {
		const guildId = player.guildId;
		await runAfterCommit(() => manageGuildReward(response, guildId, packet));
		return;
	}
	await manageClassicReward(response, player, packet.amount, rewardKind);
	await player.save();
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

		const packet = makePacket(SmallEventBonusGuildPVEIslandPacket, {
			event,
			result: issue,
			surrounding: player.hasAGuild()
				? !enoughMembers && issue === SmallEventBonusGuildPVEIslandResultType.SUCCESS
					? SmallEventBonusGuildPVEIslandOutcomeSurrounding.SOLO_WITH_GUILD
					: SmallEventBonusGuildPVEIslandOutcomeSurrounding.WITH_GUILD
				: SmallEventBonusGuildPVEIslandOutcomeSurrounding.SOLO,
			amount: 0,
			isExperienceGain: false
		});
		if (issue !== SmallEventBonusGuildPVEIslandResultType.ESCAPE) {
			await applyPossibility(player, response, packet, bonusGuildPVEIslandProperties.events[event][issue][
				player.hasAGuild()
					? SmallEventBonusGuildPVEIslandOutcomeSurrounding.WITH_GUILD
					: SmallEventBonusGuildPVEIslandOutcomeSurrounding.SOLO
			]);
		}
		response.push(packet);
	}
};
