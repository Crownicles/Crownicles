import Player from "../database/game/models/Player";
import { IMission } from "./IMission";
import MissionSlot, { MissionSlots } from "../database/game/models/MissionSlot";
import DailyMission, { DailyMissions } from "../database/game/models/DailyMission";
import {
	asHours,
	datesAreOnSameDay,
	getTodayMidnight,
	hoursToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { MissionDifficulty } from "./MissionDifficulty";
import { Campaign } from "./Campaign";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import PlayerMissionsInfo from "../database/game/models/PlayerMissionsInfo";
import {
	CrowniclesPacket,
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MissionsExpiredPacket } from "../../../../Lib/src/packets/events/MissionsExpiredPacket";
import { crowniclesInstance } from "../../index";
import {
	Mission, MissionDataController
} from "../../data/Mission";
import { MissionsCompletedPacket } from "../../../../Lib/src/packets/events/MissionsCompletedPacket";
import {
	BaseMission, CompletedMission, MissionType
} from "../../../../Lib/src/types/CompletedMission";
import { FightActionController } from "../fights/actions/FightActionController";
import { MissionUtils } from "../../../../Lib/src/utils/MissionUtils";
import { MapLocationDataController } from "../../data/MapLocation";
import { InventorySlots } from "../database/game/models/InventorySlot";
import { BlessingManager } from "../blessings/BlessingManager";
import { PetEntities } from "../database/game/models/PetEntity";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { assertUnderLock } from "../../../../Lib/src/locks/CLSNamespace";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";


type MissionInformations = {
	missionId: string;

	/**
	 * Mission progress delta (or absolute value when `set` is true). Pass a
	 * function to defer the computation until the player row is locked — useful
	 * when the count depends on fields that may have been written by a
	 * concurrent transaction (e.g. the sum of attack + defense glory points).
	 * The function runs inside the lock, AFTER `applyOnLockedPlayer`.
	 */
	count?: number | ((lockedPlayer: Player) => number);
	params?: { [key: string]: unknown };
	set?: boolean;

	/**
	 * Optional mutation applied to the freshly-locked `Player` instance
	 * BEFORE the mission logic runs and BEFORE the lock-owned `.save()`.
	 *
	 * Use this when the caller's reason for triggering the mission is itself
	 * a player update (e.g. `lockedPlayer.money += amount` for `earnMoney`).
	 * Routing the mutation through this callback keeps the read-mutate-save
	 * sequence inside the same row lock, so the field cannot be clobbered
	 * by the re-fetch nor lost to a concurrent writer.
	 *
	 * Do NOT mutate the caller's player before invoking `update`; let this
	 * callback own the mutation. The caller will receive the up-to-date
	 * locked instance back from `update` and can mirror it onto its own
	 * reference via `Object.assign`.
	 *
	 * @see https://github.com/Crownicles/Crownicles/issues/4207
	 */
	applyOnLockedPlayer?: (lockedPlayer: Player) => void;
};

/**
 * Internal shape passed to all *UnderLock helpers once the optional `count`
 * function has been resolved against the locked player.
 */
type ResolvedMissionInformations = Omit<MissionInformations, "count"> & { count: number };

export type GeneratedMission = {
	mission: Mission;
	index: number;
	variant: number;
};

type GenerateMissionPropertiesOptions = {
	mission?: Mission;
	daily?: boolean;
	player?: Player;
};

type SpecialMissionCompletion = {
	daily: boolean;
	campaign: boolean;
};

export abstract class MissionsController {
	static getMissionInterface(missionId: string): IMission {
		try {
			return (require(`./interfaces/${missionId}`) as {
				missionInterface: IMission;
			}).missionInterface;
		}
		catch {
			// Forced to use a require, as importing the base interface directly will result in a cyclic import (DefaultInterface -> IMission -> Player -> MissionController)
			return require("./DefaultInterface").missionInterface;
		}
	}

	/**
	 * Check and update the completed missions of the Player
	 * @param player
	 * @param missionSlots
	 * @param missionInfo
	 * @param response the response packets
	 * @param specialMissionCompletion
	 */
	static async checkCompletedMissionsUnderLock(
		player: Player,
		missionSlots: MissionSlot[],
		missionInfo: PlayerMissionsInfo,
		response: CrowniclesPacket[],
		specialMissionCompletion: SpecialMissionCompletion = {
			daily: false,
			campaign: false
		},
		dailyMission: DailyMission | null = null
	): Promise<Player> {
		assertUnderLock("MissionsController.checkCompletedMissionsUnderLock");
		const completedMissions = await MissionsController.completeAndUpdateMissionsUnderLock(player, missionSlots, specialMissionCompletion, dailyMission);
		if (completedMissions.length !== 0) {
			player = await MissionsController.updatePlayerStats(player, missionInfo, completedMissions, response);
			for (const mission of completedMissions) {
				mission.moneyToWin = BlessingManager.getInstance().applyMoneyBlessing(mission.moneyToWin);
				mission.pointsToWin = Math.round(mission.pointsToWin * BlessingManager.getInstance().getScoreMultiplier());
			}
			response.push(makePacket(MissionsCompletedPacket, {
				missions: MissionsController.prepareBaseMissions(completedMissions),
				keycloakId: player.keycloakId
			}));

			// Give pet rewards from campaign missions
			for (const mission of completedMissions) {
				if (mission.petRewardTypeId) {
					const pet = PetEntities.createPet(
						mission.petRewardTypeId,
						RandomUtils.crowniclesRandom.pick([PetConstants.SEX.MALE, PetConstants.SEX.FEMALE]),
						""
					);
					await pet.giveToPlayer(player, response);
				}
			}
		}

		return player;
	}

	/**
	 * Handle the dailyStreak mission update when a daily mission is completed.
	 * Resets the streak if the player missed a day (last completion was not yesterday).
	 * This MUST be called BEFORE updating lastDailyMissionCompleted to get accurate streak tracking.
	 * @param player
	 * @param missionSlots
	 * @param missionInfo
	 * @param response
	 */
	private static async handleDailyStreakMissionUnderLock(
		player: Player,
		missionSlots: MissionSlot[],
		missionInfo: PlayerMissionsInfo,
		response: CrowniclesPacket[]
	): Promise<void> {
		assertUnderLock("MissionsController.handleDailyStreakMissionUnderLock");
		const streakMission = missionSlots.find(slot => slot.missionId === "dailyStreak");
		if (!streakMission || streakMission.isCompleted()) {
			// Update the mission if the player doesn't have it or has already completed it
			await MissionsController.update(player, response, { missionId: "dailyStreak" });
			return;
		}

		// Check if the player completed the daily mission yesterday
		const today = getTodayMidnight();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		// Check the last completion date
		const lastCompleted = missionInfo.lastDailyMissionCompleted;
		if (lastCompleted) {
			const lastCompletedDate = new Date(lastCompleted);

			// If the last completion was NOT yesterday and NOT today, reset the streak
			if (!datesAreOnSameDay(lastCompletedDate, yesterday) && !datesAreOnSameDay(lastCompletedDate, today)) {
				streakMission.numberDone = 0;
				await streakMission.save();
			}
		}

		// Update the dailyStreak mission
		await MissionsController.update(player, response, { missionId: "dailyStreak" });
	}

	/**
	 * Update all the mission of the user
	 * @param player
	 * @param response the response packets
	 * @param missionId
	 * @param count
	 * @param params
	 * @param set
	 */
	static async update(
		player: Player,
		response: CrowniclesPacket[],
		{
			missionId,
			count = 1,
			params = {},
			set = false,
			applyOnLockedPlayer
		}: MissionInformations
	): Promise<Player> {
		/*
		 * Resolve the current daily mission BEFORE acquiring the per-player lock.
		 * DailyMissions.getOrGenerate() can run a whole-table UPDATE on player_missions_info
		 * when the daily mission rolls over, which would otherwise be executed inside this
		 * player's transaction and hold row locks on every player_missions_info row
		 * until the transaction commits — causing cascading ER_LOCK_WAIT_TIMEOUT (1205).
		 */
		const dailyMission = await DailyMissions.getOrGenerate();
		try {
			return await withLockedEntities(
				[
					Player.lockKey(player.id),
					PlayerMissionsInfo.lockKey(player.id)
				] as const,
				([lockedPlayer, lockedMissionInfo]) => {
					/*
					 * Apply the caller-supplied mutation on the locked instance so
					 * the change is persisted under the same row lock as the mission
					 * progression — see `applyOnLockedPlayer` JSDoc and #4207.
					 */
					applyOnLockedPlayer?.(lockedPlayer);
					const resolvedCount = typeof count === "function" ? count(lockedPlayer) : count;
					const info: ResolvedMissionInformations = {
						missionId, count: resolvedCount, params, set, applyOnLockedPlayer
					};
					return MissionsController.runUpdateUnderLock(lockedPlayer, lockedMissionInfo, response, info, dailyMission);
				}
			);
		}
		catch (e) {
			if (e instanceof LockedRowNotFoundError) {
				CrowniclesLogger.warn(
					`MissionsController.update: locked row vanished for player ${player.id} — skipping mission update`
				);
				return player;
			}
			throw e;
		}
	}

	private static async runUpdateUnderLock(
		player: Player,
		missionInfo: PlayerMissionsInfo,
		response: CrowniclesPacket[],
		info: ResolvedMissionInformations,
		dailyMission: DailyMission
	): Promise<Player> {
		const missionSlots = await MissionSlots.getOfPlayer(player.id);

		await MissionsController.handleExpiredMissionsUnderLock(player, missionSlots, response);
		const specialMissionCompletion = await MissionsController.updateMissionsCountsUnderLock(
			info, missionSlots, missionInfo, player, response, dailyMission
		);
		const updated = await MissionsController.checkCompletedMissionsUnderLock(
			player, missionSlots, missionInfo, response, specialMissionCompletion, dailyMission
		);

		await updated.save();
		return updated;
	}

	/**
	 * Complete and update the missions of a user
	 * @param player
	 * @param missionSlots
	 * @param specialMissionCompletion
	 */
	static async completeAndUpdateMissionsUnderLock(
		player: Player,
		missionSlots: MissionSlot[],
		specialMissionCompletion: SpecialMissionCompletion,
		dailyMission: DailyMission | null = null
	): Promise<CompletedMission[]> {
		assertUnderLock("MissionsController.completeAndUpdateMissionsUnderLock");
		const completedMissions: CompletedMission[] = [];
		completedMissions.push(...await Campaign.updatePlayerCampaign(specialMissionCompletion.campaign, player));
		for (const mission of missionSlots.filter(mission => mission.isCompleted() && !mission.isCampaign())) {
			completedMissions.push({
				...mission.toJSON(),
				missionType: MissionType.NORMAL,
				gemsToWin: 0 // Don't win gems in secondary missions
			});
			crowniclesInstance?.logsDatabase.logMissionFinished(player.keycloakId, mission.missionId, mission.missionVariant, mission.missionObjective)
				.then();
			await mission.destroy();
		}
		if (specialMissionCompletion.daily) {
			const resolvedDailyMission = dailyMission ?? await DailyMissions.getOrGenerate();
			const blessingMultiplier = BlessingManager.getInstance().getDailyMissionMultiplier();
			completedMissions.push({
				...resolvedDailyMission.toJSON(),
				missionType: MissionType.DAILY,
				gemsToWin: Math.round(resolvedDailyMission.gemsToWin * blessingMultiplier),
				xpToWin: Math.round(resolvedDailyMission.xpToWin * blessingMultiplier),
				moneyToWin: Math.round(resolvedDailyMission.moneyToWin * Constants.MISSIONS.DAILY_MISSION_MONEY_MULTIPLIER * blessingMultiplier),
				pointsToWin: Math.round(resolvedDailyMission.pointsToWin * Constants.MISSIONS.DAILY_MISSION_POINTS_MULTIPLIER * blessingMultiplier)
			});
			crowniclesInstance?.logsDatabase.logMissionDailyFinished(player.keycloakId)
				.then();
		}

		await player.save();
		return completedMissions;
	}

	static async updatePlayerStats(player: Player, missionInfo: PlayerMissionsInfo, completedMissions: CompletedMission[], response: CrowniclesPacket[]): Promise<Player> {
		// Totalizer function to sum the values of the completed missions
		const totalizer = (mapper: (m: CompletedMission) => number): number => completedMissions.map(mapper)
			.reduce((a, b) => a + b);

		await missionInfo.addGems(totalizer(m => m.gemsToWin), player.keycloakId, NumberChangeReason.MISSION_FINISHED);

		player = await player.addExperience({
			amount: totalizer(m => m.xpToWin),
			response,
			reason: NumberChangeReason.MISSION_FINISHED
		}, await InventorySlots.getPlayerActiveObjects(player.id));
		player = await player.addMoney({
			amount: totalizer(m => m.moneyToWin),
			response,
			reason: NumberChangeReason.MISSION_FINISHED
		});
		player = await player.addScore({
			amount: totalizer(m => m.pointsToWin),
			response,
			reason: NumberChangeReason.MISSION_FINISHED
		});

		return player;
	}

	static async handleExpiredMissionsUnderLock(player: Player, missionSlots: MissionSlot[], response: CrowniclesPacket[]): Promise<void> {
		assertUnderLock("MissionsController.handleExpiredMissionsUnderLock");
		const expiredMissions: MissionSlot[] = [];
		for (const mission of missionSlots) {
			if (mission.hasExpired()) {
				expiredMissions.push(mission);
				crowniclesInstance?.logsDatabase.logMissionFailed(player.keycloakId, mission.missionId, mission.missionVariant, mission.missionObjective)
					.then();
				await mission.destroy();
			}
		}
		if (expiredMissions.length === 0) {
			return;
		}

		response.push(makePacket(MissionsExpiredPacket, {
			missions: MissionsController.prepareMissionSlots(expiredMissions),
			keycloakId: player.keycloakId
		}));
		await player.save();
	}

	/**
	 * Prepare a mission to be sent to the front-end
	 * @param mission
	 */
	public static prepareMissionSlot(mission: MissionSlot): BaseMission {
		return this.prepareBaseMission(mission.toBaseMission());
	}

	public static prepareBaseMissions(missions: BaseMission[]): BaseMission[] {
		return missions.map(mission => this.prepareBaseMission(mission));
	}

	public static prepareBaseMission(baseMission: BaseMission): BaseMission {
		if (baseMission.expiresAt) {
			baseMission.expiresAt = new Date(baseMission.expiresAt).toString();
		}
		if (MissionUtils.isRequiredFightActionId(baseMission)) {
			baseMission.fightAction = FightActionController.variantToFightActionId(baseMission.missionVariant) ?? undefined;
		}
		if (MissionUtils.isRequiredMapLocationMapType(baseMission)) {
			baseMission.mapType = MapLocationDataController.instance.getById(baseMission.missionVariant)!.type;
		}
		return baseMission;
	}

	/**
	 * Prepare the missions to be sent to the front-end
	 * @param missionSlots
	 */
	public static prepareMissionSlots(missionSlots: MissionSlot[]): BaseMission[] {
		return missionSlots.map(mission => MissionsController.prepareMissionSlot(mission));
	}

	public static generateRandomDailyMissionProperties(): GeneratedMission {
		const mission = MissionDataController.instance.getRandomDailyMission();

		// Daily missions always return a valid GeneratedMission since daily=true bypasses difficulty filtering
		return this.generateMissionProperties(mission.id, MissionDifficulty.EASY, {
			mission,
			daily: true
		})!;
	}

	public static generateMissionProperties(missionId: string, difficulty: MissionDifficulty, {
		mission,
		daily = false,
		player
	}: GenerateMissionPropertiesOptions): GeneratedMission | null {
		let resolvedMission = mission;
		if (!resolvedMission) {
			resolvedMission = MissionDataController.instance.getById(missionId);
			if (!resolvedMission) {
				return null;
			}
		}
		const missionIndex = this.generateMissionIndex(resolvedMission, difficulty);
		const variant = this.getMissionInterface(resolvedMission.id)
			.generateRandomVariant(difficulty, player as Player);
		if (!daily) {
			if (missionIndex === null) {
				return null;
			}
			return {
				mission: resolvedMission,
				index: missionIndex,
				variant
			};
		}
		return {
			mission: resolvedMission,
			index: RandomUtils.crowniclesRandom.pick(resolvedMission.dailyIndexes!),
			variant
		};
	}

	public static async addMissionToPlayer(player: Player, missionId: string, difficulty: MissionDifficulty, mission?: Mission): Promise<MissionSlot> {
		const prop = this.generateMissionProperties(missionId, difficulty, {
			mission,
			daily: false,
			player
		})!;
		const missionData = MissionDataController.instance.getById(missionId)!;
		const missionSlot = await MissionSlot.create({
			playerId: player.id,
			missionId: prop.mission.id,
			missionVariant: prop.variant,
			missionObjective: missionData.objectives![prop.index],
			expiresAt: new Date(Date.now() + hoursToMilliseconds(asHours(missionData.expirations![prop.index]))),
			numberDone: await this.getMissionInterface(missionId)
				.initialNumberDone(player, prop.variant),
			gemsToWin: missionData.gems![prop.index],
			pointsToWin: missionData.points![prop.index],
			xpToWin: missionData.xp![prop.index],
			moneyToWin: missionData.money![prop.index]
		});
		const retMission = await MissionSlots.getById(missionSlot.id);
		crowniclesInstance?.logsDatabase.logMissionFound(player.keycloakId, retMission.missionId, retMission.missionVariant, retMission.missionObjective)
			.then();
		return retMission;
	}

	public static async addRandomMissionToPlayer(player: Player, difficulty: MissionDifficulty, exception = ""): Promise<MissionSlot> {
		const mission = MissionDataController.instance.getRandomMission(difficulty, exception);
		return await MissionsController.addMissionToPlayer(player, mission.id, difficulty, mission);
	}

	public static getRandomDifficulty(player: Player): MissionDifficulty {
		for (let i = Constants.MISSIONS.SLOTS_LEVEL_PROBABILITIES.length - 1; i >= 0; i--) {
			const probability = Constants.MISSIONS.SLOTS_LEVEL_PROBABILITIES[i];
			if (player.level >= probability.LEVEL) {
				const randomNumber = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
				return randomNumber < probability.EASY
					? MissionDifficulty.EASY
					: randomNumber < probability.MEDIUM + probability.EASY
						? MissionDifficulty.MEDIUM
						: MissionDifficulty.HARD;
			}
		}

		return MissionDifficulty.EASY;
	}

	private static generateMissionIndex(mission: Mission, difficulty: MissionDifficulty): number | null {
		if (difficulty === MissionDifficulty.EASY && mission.canBeEasy()) {
			return RandomUtils.crowniclesRandom.pick(mission.difficulties!.easy!);
		}
		if (difficulty === MissionDifficulty.MEDIUM && mission.canBeMedium()) {
			return RandomUtils.crowniclesRandom.pick(mission.difficulties!.medium!);
		}
		if (difficulty === MissionDifficulty.HARD && mission.canBeHard()) {
			return RandomUtils.crowniclesRandom.pick(mission.difficulties!.hard!);
		}
		return null;
	}

	/**
	 * Update the counts of the different mission the user has
	 * @param missionInformation
	 * @param missionSlots
	 * @param missionInfo
	 * @param player
	 * @param response
	 * @returns true if the daily mission is finished and needs to be said to the player
	 */
	private static async updateDailyMissionCountUnderLock(
		ctx: {
			missionInformation: ResolvedMissionInformations;
			missionInterface: IMission;
			missionInfo: PlayerMissionsInfo;
			missionSlots: MissionSlot[];
			player: Player;
			response: CrowniclesPacket[];
			count: number;
			dailyMission: DailyMission;
		}
	): Promise<boolean> {
		assertUnderLock("MissionsController.updateDailyMissionCountUnderLock");
		const {
			missionInformation, missionInterface, missionInfo, missionSlots, player, response, count, dailyMission
		} = ctx;
		if (missionInfo.hasCompletedDailyMission()) {
			return false;
		}
		if (dailyMission.missionId !== missionInformation.missionId
			|| !missionInterface.areParamsMatchingVariantAndBlob(dailyMission.missionVariant, missionInformation.params!, missionInfo.dailyMissionBlob)) {
			return false;
		}

		missionInfo.dailyMissionBlob = missionInterface.updateSaveBlob(dailyMission.missionVariant, missionInfo.dailyMissionBlob, missionInformation.params!);

		if (missionInformation.set) {
			missionInfo.dailyMissionNumberDone = Math.max(missionInfo.dailyMissionNumberDone, count);
		}
		else {
			missionInfo.dailyMissionNumberDone += count;
		}
		missionInfo.dailyMissionNumberDone = Math.min(missionInfo.dailyMissionNumberDone, dailyMission.missionObjective);
		await missionInfo.save();

		if (missionInfo.dailyMissionNumberDone >= dailyMission.missionObjective) {
			await MissionsController.handleDailyStreakMissionUnderLock(player, missionSlots, missionInfo, response);
			missionInfo.lastDailyMissionCompleted = new Date();
			await missionInfo.save();
			return true;
		}
		return false;
	}

	private static async updateMissionsCountsUnderLock(
		missionInformation: ResolvedMissionInformations,
		missionSlots: MissionSlot[],
		missionInfo: PlayerMissionsInfo,
		player: Player,
		response: CrowniclesPacket[],
		dailyMission: DailyMission
	): Promise<SpecialMissionCompletion> {
		assertUnderLock("MissionsController.updateMissionsCountsUnderLock");
		const missionInterface = this.getMissionInterface(missionInformation.missionId);
		const count = missionInformation.count ?? 1;
		const dailyCompleted = await this.updateDailyMissionCountUnderLock({
			missionInformation, missionInterface, missionInfo, missionSlots, player, response, count, dailyMission
		});
		return {
			daily: dailyCompleted,
			campaign: await this.checkMissionSlotsUnderLock(missionInterface, missionInformation, missionSlots)
		};
	}

	/**
	 * Updates the missions located in the mission slots of the player
	 * @param missionInterface
	 * @param missionInformations
	 * @param missionSlots
	 */
	private static async checkMissionSlotsUnderLock(missionInterface: IMission, missionInformations: ResolvedMissionInformations, missionSlots: MissionSlot[]): Promise<boolean> {
		assertUnderLock("MissionsController.checkMissionSlotsUnderLock");
		let completedCampaign = false;
		for (const mission of missionSlots.filter(missionSlot => missionSlot.missionId === missionInformations.missionId)) {
			const paramsMatch = missionInterface.areParamsMatchingVariantAndBlob(mission.missionVariant, missionInformations.params!, mission.saveBlob);
			if (paramsMatch && !mission.hasExpired() && !mission.isCompleted()) {
				await this.updateMissionUnderLock(mission, missionInformations);
				completedCampaign = completedCampaign || mission.isCampaign() && mission.isCompleted();
			}

			// Update blob if mission is not completed AND either params match OR mission explicitly wants to always update blob
			if (this.shouldUpdateBlob(mission, paramsMatch, missionInterface.alwaysUpdateBlob!)) {
				await this.updateBlobUnderLock(missionInterface, mission, missionInformations);
			}
		}
		return completedCampaign;
	}

	/**
	 * Determines if the mission blob should be updated
	 * @param mission The mission to check
	 * @param paramsMatch Whether the params match
	 * @param alwaysUpdateBlob Whether to always update the blob
	 * @returns true if the blob should be updated
	 */
	private static shouldUpdateBlob(mission: MissionSlot, paramsMatch: boolean, alwaysUpdateBlob: boolean): boolean {
		return !mission.isCompleted() && (paramsMatch || alwaysUpdateBlob);
	}

	/**
	 * Updates the mission blob if needed
	 * @param missionInterface
	 * @param mission
	 * @param missionInformations
	 */
	private static async updateBlobUnderLock(missionInterface: IMission, mission: MissionSlot, missionInformations: ResolvedMissionInformations): Promise<void> {
		assertUnderLock("MissionsController.updateBlobUnderLock");
		const saveBlob = missionInterface.updateSaveBlob(mission.missionVariant, mission.saveBlob, missionInformations.params!);
		if (saveBlob !== mission.saveBlob) {
			mission.saveBlob = saveBlob;
			await mission.save();
		}
	}

	/**
	 * Updates the progression of the mission
	 * @param mission
	 * @param missionInformations
	 */
	private static async updateMissionUnderLock(mission: MissionSlot, missionInformations: ResolvedMissionInformations): Promise<void> {
		assertUnderLock("MissionsController.updateMissionUnderLock");
		const count = missionInformations.count ?? 1;
		mission.numberDone = Math.min(mission.missionObjective, missionInformations.set ? count : mission.numberDone + count);
		await mission.save();
	}
}
