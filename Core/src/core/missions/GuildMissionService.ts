import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Guild, { Guilds } from "../database/game/models/Guild";
import Player, { Players } from "../database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	getDayNumber
} from "../../../../Lib/src/utils/TimeUtils";
import { MissionsController } from "./MissionsController";
import { LockManager } from "../../../../Lib/src/locks/LockManager";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { GuildMissionCompletedPacket } from "../../../../Lib/src/packets/events/GuildMissionCompletedPacket";
import { MissionDataController } from "../../data/Mission";

const guildMissionLockManager = new LockManager();

export abstract class GuildMissionService {
	/**
	 * Check if the given guild has an active (non-expired) mission
	 */
	static hasActiveMission(guild: Guild): boolean {
		return guild.guildMissionId !== null
			&& guild.guildMissionExpiry !== null
			&& new Date(guild.guildMissionExpiry) > new Date();
	}

	/**
	 * Check if the guild mission is completed
	 */
	static isMissionCompleted(guild: Guild): boolean {
		return guild.guildMissionId !== null
			&& guild.guildMissionNumberDone >= guild.guildMissionObjective;
	}

	/**
	 * Generate a new weekly mission for the guild
	 */
	static generateMission(guild: Guild): void {
		const guildMissions = MissionDataController.instance.getGuildMissions();
		const mission = RandomUtils.crowniclesRandom.pick(guildMissions);
		const objectives = mission.guildMission!.objectives;
		const objectiveIndex = Math.min(
			Math.floor(guild.level / GuildDomainConstants.GUILD_MISSIONS.GUILD_LEVELS_PER_OBJECTIVE_TIER),
			objectives.length - 1
		);

		guild.guildMissionId = mission.id;
		guild.guildMissionVariant = 0;
		guild.guildMissionObjective = objectives[objectiveIndex];
		guild.guildMissionNumberDone = 0;
		guild.guildMissionBlob = null;
		guild.guildMissionExpiry = new Date(Date.now() + GuildDomainConstants.GUILD_MISSIONS.DURATION_MS);
	}

	/**
	 * Ensure the guild has an active mission, generating one if needed
	 */
	static ensureActiveMission(guild: Guild): void {
		if (!GuildMissionService.hasActiveMission(guild) && !GuildMissionService.isMissionCompleted(guild)) {
			GuildMissionService.generateMission(guild);
		}
	}

	/**
	 * Apply streak-mission specific logic on the guild mission state.
	 * Returns the count to add to numberDone (0 if it's a same-day repeat that should only bump contribution).
	 */
	private static applyStreakLogic(guild: Guild, count: number): number {
		const today = getDayNumber();
		if (guild.guildMissionBlob) {
			const lastDay = guild.guildMissionBlob.readInt32LE(0);
			if (lastDay === today) {
				return 0;
			}
			if (lastDay !== today - 1) {
				guild.guildMissionNumberDone = 0;
			}
		}
		const buffer = Buffer.alloc(4);
		buffer.writeInt32LE(today);
		guild.guildMissionBlob = buffer;
		return Math.min(count, 1);
	}

	private static async tryProgressGuildMission(
		guild: Guild,
		missionId: string,
		count: number,
		missionInfo: PlayerMissionsInfo
	): Promise<boolean> {
		GuildMissionService.ensureActiveMission(guild);
		await guild.save();

		if (!GuildMissionService.canProgressMission(guild, missionId)) {
			return false;
		}

		const effectiveCount = GuildMissionService.computeEffectiveCount(guild, missionId, count);
		missionInfo.guildMissionContribution += count;
		await missionInfo.save();
		if (effectiveCount === 0) {
			return false;
		}

		guild.guildMissionNumberDone = Math.min(
			guild.guildMissionNumberDone + effectiveCount,
			guild.guildMissionObjective
		);
		await guild.save();

		return guild.guildMissionNumberDone >= guild.guildMissionObjective;
	}

	private static canProgressMission(guild: Guild, missionId: string): boolean {
		const isActive = GuildMissionService.hasActiveMission(guild);
		const isCompleted = GuildMissionService.isMissionCompleted(guild);
		const matchesId = guild.guildMissionId === missionId;
		if (!isActive || isCompleted || !matchesId) {
			return false;
		}
		const missionInterface = MissionsController.getMissionInterface(missionId);
		return missionInterface.areParamsMatchingVariantAndBlob(guild.guildMissionVariant, {}, guild.guildMissionBlob);
	}

	private static computeEffectiveCount(guild: Guild, missionId: string, count: number): number {
		const missionData = MissionDataController.instance.getById(missionId);
		if (missionData?.guildMission?.streak) {
			return GuildMissionService.applyStreakLogic(guild, count);
		}
		return count;
	}

	/**
	 * Update the guild mission progress when the player performs an action.
	 * Called from MissionsController.updateMissionsCounts after daily mission handling.
	 */
	static async updateGuildMission(
		missionId: string,
		count: number,
		player: Player,
		missionInfo: PlayerMissionsInfo
	): Promise<boolean> {
		if (!player.guildId) {
			return false;
		}
		const lock = guildMissionLockManager.getLock(player.guildId);
		const release = await lock.acquire();
		try {
			const guild = (await Guilds.getById(player.guildId))!;
			return await GuildMissionService.tryProgressGuildMission(guild, missionId, count, missionInfo);
		}
		finally {
			release();
		}
	}

	/**
	 * Distribute rewards to all guild members who contributed, then reset the mission state
	 */
	static async distributeRewards(
		player: Player,
		response: CrowniclesPacket[]
	): Promise<void> {
		if (!player.guildId) {
			return;
		}

		const lock = guildMissionLockManager.getLock(player.guildId);
		const release = await lock.acquire();
		try {
			await GuildMissionService.distributeRewardsLocked(player, response);
		}
		finally {
			release();
		}
	}

	private static async distributeRewardsLocked(
		player: Player,
		response: CrowniclesPacket[]
	): Promise<void> {
		const guild = (await Guilds.getById(player.guildId!))!;

		// Idempotency: another concurrent caller may already have distributed and reset the mission
		if (guild.guildMissionId === null) {
			return;
		}

		const rewards = GuildDomainConstants.GUILD_MISSIONS.REWARDS;

		// Guild-level rewards (applied once)
		await guild.addExperience({
			amount: rewards.GUILD_XP,
			response,
			reason: NumberChangeReason.GUILD_MISSION
		});
		guild.treasury += rewards.TREASURY_GOLD;
		await guild.addScore({
			amount: rewards.GUILD_SCORE,
			response,
			reason: NumberChangeReason.GUILD_MISSION
		});

		// Personal XP for ALL guild members who contributed
		const guildMembers = await Players.getByGuild(guild.id);
		const now = new Date();

		for (const member of guildMembers) {
			const missionInfo = await PlayerMissionsInfos.getOfPlayer(member.id);

			if (missionInfo.guildMissionContribution <= 0) {
				continue;
			}

			// Give personal XP
			const updatedMember = await member.addExperience({
				amount: rewards.PERSONAL_XP,
				response,
				reason: NumberChangeReason.GUILD_MISSION
			}, await InventorySlots.getPlayerActiveObjects(member.id));
			await updatedMember.save();

			// Mark completion and reset contribution
			missionInfo.lastGuildMissionCompleted = now;
			missionInfo.guildMissionContribution = 0;
			await missionInfo.save();

			// Notify each contributing member
			response.push(makePacket(GuildMissionCompletedPacket, {
				guildXp: rewards.GUILD_XP,
				guildScore: rewards.GUILD_SCORE,
				treasuryGold: rewards.TREASURY_GOLD,
				personalXp: rewards.PERSONAL_XP,
				keycloakId: member.keycloakId
			}));
		}

		// Reset guild mission state for next week
		guild.guildMissionId = null;
		guild.guildMissionNumberDone = 0;
		guild.guildMissionObjective = 0;
		guild.guildMissionVariant = 0;
		guild.guildMissionBlob = null;
		guild.guildMissionExpiry = null;
		await guild.save();
	}
}
