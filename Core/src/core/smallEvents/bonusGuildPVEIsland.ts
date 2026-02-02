import {
	SmallEventDataController, SmallEventFuncs
} from "../../data/SmallEvent";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import {
	SmallEventBonusGuildPVEIslandOutcomeSurrounding,
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
import { Guilds } from "../database/game/models/Guild";
import { InventorySlots } from "../database/game/models/InventorySlot";

enum Outcome {
	EXPERIENCE = "experience",
	MONEY = "money",
	LIFE = "life",
	ENERGY = "energy",
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

type Winnings = {
	amount: number;
	isExperienceGain: boolean;
};

async function manageGuildReward(response: CrowniclesPacket[], player: Player, result: Winnings): Promise<void> {
	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return;
	}
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
}

async function manageClassicReward(response: CrowniclesPacket[], player: Player, result: Winnings, rewardKind: Outcome): Promise<void> {
	const reason = NumberChangeReason.SMALL_EVENT;
	const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(player.id);
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
		case Outcome.ENERGY:
			player.addEnergy(-result.amount, reason, playerActiveObjects);
			if (player.getCumulativeEnergy(playerActiveObjects) <= 0) {
				await player.leavePVEIslandIfNoEnergy(response, playerActiveObjects);
			}
			break;
		case Outcome.EXPERIENCE:
			await player.addExperience({
				amount: result.amount,
				response,
				reason
			}, playerActiveObjects);
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
	const result = {
		amount: RandomUtils.randInt(rewardRange.min, rewardRange.max),
		isExperienceGain: rewardKind === Outcome.EXP_OR_POINTS_GUILD && RandomUtils.crowniclesRandom.bool()
	};
	if (issue === SmallEventBonusGuildPVEIslandResultType.SUCCESS && player.hasAGuild()) {
		await manageGuildReward(response, player, result);
		return result;
	}
	await manageClassicReward(response, player, result, rewardKind);
	await player.save();
	return result;
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
