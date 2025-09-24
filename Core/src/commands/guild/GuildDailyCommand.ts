import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildDailyCooldownErrorPacket,
	CommandGuildDailyPacketReq,
	CommandGuildDailyPveIslandErrorPacket,
	CommandGuildDailyRewardPacket
} from "../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import Guild, { Guilds } from "../../core/database/game/models/Guild";
import { PetEntities } from "../../core/database/game/models/PetEntity";
import { GuildPets } from "../../core/database/game/models/GuildPet";
import Player, { Players } from "../../core/database/game/models/Player";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { GuildDailyConstants } from "../../../../Lib/src/constants/GuildDailyConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { crowniclesInstance } from "../../index";
import { Effect } from "../../../../Lib/src/types/Effect";
import { TravelTime } from "../../core/maps/TravelTime";
import {
	hoursToMilliseconds, hoursToMinutes, millisecondsToHours
} from "../../../../Lib/src/utils/TimeUtils";
import { MissionsController } from "../../core/missions/MissionsController";
import { GuildDailyNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildDailyNotificationPacket";
import { PacketUtils } from "../../core/utils/PacketUtils";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { Maps } from "../../core/maps/Maps";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PlayerActiveObjects } from "../../core/database/game/models/PlayerActiveObjects";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";

type GuildLikeMember = {
	player: Player;
	activeObjects?: PlayerActiveObjects;
};

type GuildLike = {
	guild: Guild;
	members: GuildLikeMember[];
};
type RewardStage = { [key: string]: number };
type FunctionRewardType = (guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket) => Promise<void>;

/**
 * Reward the guild with a new pet if they are lucky
 * @param guild
 * @param rewardPacket
 */
async function awardGuildWithNewPet(guild: Guild, rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const pet = PetEntities.generateRandomPetEntity(guild.level);
	await pet.save();
	await GuildPets.addPet(guild, pet, true).save();
	rewardPacket.pet = {
		typeId: pet.typeId,
		isFemale: pet.isFemale()
	};
}

/**
 * Generic function to call when awarding members of a guild personally
 * @param members
 * @param awardingFunctionForAMember
 */
async function genericAwardingFunction(members: GuildLikeMember[], awardingFunctionForAMember: (member: GuildLikeMember) => Promise<void> | void): Promise<void> {
	for (const member of members) {
		// We have to check if the member is not KO because if he is, he can't receive the reward
		if (member.player.isDead()) {
			continue;
		}
		await awardingFunctionForAMember(member);
		await member.player.save();
	}
}

/**
 * Get if someone in the guild needs healing
 * @param guildLike
 */
function doesSomeoneNeedsHeal(guildLike: GuildLike): boolean {
	return guildLike.members.some(member => member.player.getHealth(member.activeObjects) < member.player.getMaxHealth(member.activeObjects));
}

/**
 * Generic function to award a partial heal to every member of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 * @param fullHeal
 */
async function healEveryMember(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket, fullHeal = false): Promise<void> {
	if (!doesSomeoneNeedsHeal(guildLike)) {
		// No heal = money
		await awardMoneyToMembers(guildLike, response, rewardPacket);
		return;
	}

	const healthWon = Math.round(guildLike.guild.level * GuildDailyConstants.LEVEL_MULTIPLIER) + 1;
	await genericAwardingFunction(guildLike.members, async member => {
		if (member.player.effectId !== Effect.DEAD.id) {
			await member.player.addHealth(
				fullHeal ? member.player.getMaxHealth(member.activeObjects) : healthWon,
				response,
				NumberChangeReason.GUILD_DAILY,
				member.activeObjects,
				{
					shouldPokeMission: true,
					overHealCountsForMission: !fullHeal
				}
			);
		}
	});
	if (fullHeal) {
		rewardPacket.fullHeal = true;
	}
	else {
		rewardPacket.heal = healthWon;
	}
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, fullHeal ? GuildDailyConstants.REWARD_TYPES.FULL_HEAL : GuildDailyConstants.REWARD_TYPES.PARTIAL_HEAL).then();
}

/**
 * Generic function to heal the members of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function alterationHealEveryMember(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const healthWon = Math.round(guildLike.guild.level * GuildDailyConstants.LEVEL_MULTIPLIER);
	let noAlterationHeal = true;
	const needsHeal = doesSomeoneNeedsHeal(guildLike);
	const now = new Date();
	await genericAwardingFunction(guildLike.members, async member => {
		if (member.player.currentEffectFinished(now)) {
			if (needsHeal) {
				await member.player.addHealth(
					healthWon,
					response,
					NumberChangeReason.GUILD_DAILY,
					member.activeObjects,
					{
						shouldPokeMission: true,
						overHealCountsForMission: true
					}
				);
			}
		}
		else if (member.player.effectId !== Effect.DEAD.id && member.player.effectId !== Effect.JAILED.id) {
			noAlterationHeal = false;
			await TravelTime.removeEffect(member.player, NumberChangeReason.GUILD_DAILY);
		}
	});
	if (!needsHeal && noAlterationHeal) {
		// No heal = money
		await awardMoneyToMembers(guildLike, response, rewardPacket);
		return;
	}

	rewardPacket.alteration = healthWon > 0 ? { healAmount: healthWon } : {};

	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.ALTERATION).then();
}

/**
 * Generic function to award experience to members of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function awardPersonalXpToMembers(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const xpWon = RandomUtils.rangedInt(GuildDailyConstants.XP, guildLike.guild.level, guildLike.guild.level * GuildDailyConstants.XP_MULTIPLIER);
	await genericAwardingFunction(guildLike.members, member => {
		member.player.addExperience({
			amount: xpWon,
			response,
			reason: NumberChangeReason.GUILD_DAILY
		}, member.activeObjects);
	});
	rewardPacket.personalXp = xpWon;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.PERSONAL_XP).then();
}

/**
 * Generic function to award experience to a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function awardGuildXp(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const xpGuildWon = RandomUtils.rangedInt(GuildDailyConstants.XP, guildLike.guild.level, guildLike.guild.level * GuildDailyConstants.XP_MULTIPLIER);
	await guildLike.guild.addExperience(xpGuildWon, response, NumberChangeReason.GUILD_DAILY);
	await guildLike.guild.save();
	rewardPacket.guildXp = xpGuildWon;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.GUILD_XP).then();
}

/**
 * Generic function to award a pet food to a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function awardCommonFood(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	if (guildLike.guild.commonFood + GuildDailyConstants.FIXED_PET_FOOD > GuildConstants.MAX_COMMON_PET_FOOD) {
		await awardMoneyToMembers(guildLike, response, rewardPacket);
		return;
	}
	guildLike.guild.commonFood += GuildDailyConstants.FIXED_PET_FOOD;
	await Promise.all([guildLike.guild.save()]);
	rewardPacket.commonFood = GuildDailyConstants.FIXED_PET_FOOD;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.PET_FOOD).then();
}

/**
 * Generic function to fully heal members of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function fullHealEveryMember(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	await healEveryMember(guildLike, response, rewardPacket, true);
}

/**
 * Generic function to award a badge to members of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function awardGuildBadgeToMembers(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	let membersThatOwnTheBadge = 0;
	await genericAwardingFunction(guildLike.members, member => {
		if (!member.player.addBadge(Badge.POWERFUL_GUILD)) {
			membersThatOwnTheBadge++;
		}
	});
	if (membersThatOwnTheBadge === guildLike.members.length) {
		// Everybody already has the badge, give something else instead
		await healEveryMember(guildLike, response, rewardPacket);
		return;
	}
	rewardPacket.badge = true;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.BADGE).then();
}

/**
 * Generic function to award advance time to every member of a guild
 * @param guildLike
 * @param _response
 * @param rewardPacket
 */
async function advanceTimeOfEveryMember(guildLike: GuildLike, _response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const timeAdvanced = Math.ceil((guildLike.guild.level + 1) * GuildDailyConstants.TIME_ADVANCED_MULTIPLIER);
	await genericAwardingFunction(guildLike.members, async member => await TravelTime.timeTravel(member.player, hoursToMinutes(timeAdvanced), NumberChangeReason.GUILD_DAILY));
	rewardPacket.advanceTime = timeAdvanced;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.HOSPITAL).then();
}

/**
 * Generic function to award the very powerful guild badge to members of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function awardGuildSuperBadgeToMembers(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	let membersThatOwnTheBadge = 0;
	const guildRank = await guildLike.guild.getRanking();

	if (guildRank > GuildConstants.SUPER_BADGE_MAX_RANK || guildRank < 0) {
		// Only guilds that are in the top ranked guilds can get the badge
		await healEveryMember(guildLike, response, rewardPacket);
		return;
	}

	await genericAwardingFunction(guildLike.members, member => {
		if (!member.player.addBadge(Badge.VERY_POWERFUL_GUILD)) {
			membersThatOwnTheBadge++;
		}
	});

	if (membersThatOwnTheBadge === guildLike.members.length) {
		// Everybody already has the badge, give something else instead
		await healEveryMember(guildLike, response, rewardPacket);
		return;
	}

	rewardPacket.superBadge = true;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.SUPER_BADGE).then();
}

/**
 * Map all possible rewards to the corresponding rewarding function
 */
function getMapOfAllRewardCommands(): Map<string, FunctionRewardType> {
	const linkToFunction = new Map<string, FunctionRewardType>();
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.PERSONAL_XP, awardPersonalXpToMembers);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.GUILD_XP, awardGuildXp);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.MONEY, awardMoneyToMembers);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.PET_FOOD, awardCommonFood);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.BADGE, awardGuildBadgeToMembers);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.SUPER_BADGE, awardGuildSuperBadgeToMembers);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.FULL_HEAL, fullHealEveryMember);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.HOSPITAL, advanceTimeOfEveryMember);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.PARTIAL_HEAL, healEveryMember);
	linkToFunction.set(GuildDailyConstants.REWARD_TYPES.ALTERATION, alterationHealEveryMember);
	return linkToFunction;
}


const linkToFunction = getMapOfAllRewardCommands();

/**
 * Updates the guildDaily mission for each member of the guild and send a private message for those who have dms opened
 * @param initiatorKeycloakId
 * @param members
 * @param response
 * @param rewardPacket
 */
async function notifyAndUpdatePlayers(initiatorKeycloakId: string, members: Player[], response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const notifications: GuildDailyNotificationPacket[] = [];
	for (const member of members) {
		// We have to check if the member is not KO because if he is, he should not receive the notification as he does not receive the reward
		if (member.isDead()) {
			continue;
		}
		if (member.keycloakId !== initiatorKeycloakId) {
			await MissionsController.update(member, response, { missionId: "guildDailyFromSomeoneElse" });
			notifications.push(makePacket(GuildDailyNotificationPacket, {
				keycloakId: member.keycloakId,
				keycloakIdOfExecutor: initiatorKeycloakId,
				reward: rewardPacket
			}));
		}
		await MissionsController.update(member, response, { missionId: "guildDaily" });
	}

	PacketUtils.sendNotifications(notifications);
}


/**
 * Generates the reward that will be awarded by the guild
 * @param guild
 */
function generateRandomProperty(guild: Guild): string {
	let resultNumber = RandomUtils.randInt(0, GuildDailyConstants.CHANCES_SUM);
	const rewardLevel = Math.floor(guild.level / GuildDailyConstants.SIZE_PALIER);
	const recompenses: RewardStage = GuildDailyConstants.GUILD_CHANCES[rewardLevel];
	for (const reward of Object.keys(recompenses)) {
		if (recompenses[reward] < resultNumber) {
			resultNumber -= recompenses[reward];
		}
		else {
			return reward;
		}
	}
	throw new Error("Error generateRandomProperty : invalid property count");
}

/**
 * Generic function to award money to every member of a guild
 * @param guildLike
 * @param response
 * @param rewardPacket
 */
async function awardMoneyToMembers(guildLike: GuildLike, response: CrowniclesPacket[], rewardPacket: CommandGuildDailyRewardPacket): Promise<void> {
	const levelUsed = Math.min(guildLike.guild.level, GuildConstants.GOLDEN_GUILD_LEVEL);
	const moneyWon = RandomUtils.rangedInt(GuildDailyConstants.MONEY, levelUsed, levelUsed * GuildDailyConstants.MONEY_MULTIPLIER);
	await genericAwardingFunction(guildLike.members, member => {
		member.player.addMoney({
			amount: moneyWon,
			response,
			reason: NumberChangeReason.GUILD_DAILY
		});
	});
	rewardPacket.money = moneyWon;
	crowniclesInstance.logsDatabase.logGuildDaily(guildLike.guild, GuildDailyConstants.REWARD_TYPES.MONEY).then();
}

/**
 * Verify if a member blocks the guild daily
 * @param members
 * @param response
 * @returns
 */
function verifyMembers(members: Player[], response: CrowniclesPacket[]): boolean {
	for (const member of members) {
		if (Maps.isOnPveIsland(member)) {
			response.push(makePacket(CommandGuildDailyPveIslandErrorPacket, {}));
			return false;
		}
		const blockingReasons = BlockingUtils.getPlayerBlockingReason(member.keycloakId);
		if (blockingReasons.length < 2 && blockingReasons.includes(BlockingConstants.REASONS.FIGHT)) {
			continue;
		}
		if (BlockingUtils.appendBlockedPacket(member.keycloakId, response)) {
			return false;
		}
	}

	return true;
}

async function generateAndGiveReward(guild: Guild, members: GuildLikeMember[], response: CrowniclesPacket[], reward: string): Promise<CommandGuildDailyRewardPacket> {
	const guildLike = {
		guild, members
	};

	const rewardPacket = makePacket(CommandGuildDailyRewardPacket, { guildName: guild.name });
	await linkToFunction.get(reward)(guildLike, response, rewardPacket); // Give the award

	if (!guildLike.guild.isPetShelterFull(await GuildPets.getOfGuild(guildLike.guild.id)) && RandomUtils.crowniclesRandom.realZeroToOneInclusive() <= GuildDailyConstants.PET_DROP_CHANCE) {
		await awardGuildWithNewPet(guildLike.guild, rewardPacket);
	}

	return rewardPacket;
}

export default class GuildDailyCommand {
	@commandRequires(CommandGuildDailyPacketReq, {
		notBlocked: true,
		level: GuildConstants.REQUIRED_LEVEL,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		guildNeeded: true,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(response: CrowniclesPacket[], player: Player, _packet: CommandGuildDailyPacketReq, _context: PacketContext, forcedReward?: string): Promise<void> {
		const guild = await Guilds.getById(player.guildId);

		// Verify if the cooldown is over
		const time = Date.now() - guild.lastDailyAt.valueOf();
		if (millisecondsToHours(time) < GuildDailyConstants.TIME_BETWEEN_DAILIES) {
			response.push(makePacket(CommandGuildDailyCooldownErrorPacket, {
				totalTime: GuildDailyConstants.TIME_BETWEEN_DAILIES,
				remainingTime: hoursToMilliseconds(GuildDailyConstants.TIME_BETWEEN_DAILIES) - time
			}));
			return;
		}

		// Verify if no member blocks the guild daily
		const members = await Players.getByGuild(guild.id);
		if (!verifyMembers(members, response)) {
			return;
		}

		// Get the reward
		const reward = forcedReward ?? generateRandomProperty(guild);

		// Build the guildLikeMembers array
		const guildLikeMembers: GuildLikeMember[] = [];
		for (const member of members) {
			guildLikeMembers.push({
				player: member,
				activeObjects: reward === GuildDailyConstants.REWARD_TYPES.PERSONAL_XP
				|| reward === GuildDailyConstants.REWARD_TYPES.PARTIAL_HEAL
				|| reward === GuildDailyConstants.REWARD_TYPES.FULL_HEAL
				|| reward === GuildDailyConstants.REWARD_TYPES.ALTERATION
					? await InventorySlots.getPlayerActiveObjects(member.id)
					: undefined
			});
		}

		// Update the last daily time
		guild.lastDailyAt = new Date();
		await guild.save();

		// Generate and give the rewards
		const rewardPacket = await generateAndGiveReward(guild, guildLikeMembers, response, reward);
		response.push(rewardPacket);

		// Send notifications and update players missions
		await notifyAndUpdatePlayers(player.keycloakId, members, response, rewardPacket);
	}
}
