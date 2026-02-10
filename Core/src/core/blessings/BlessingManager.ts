import {
	GlobalBlessing, GlobalBlessings
} from "../database/game/models/GlobalBlessing";
import {
	BlessingConstants, BlessingType
} from "../../../../Lib/src/constants/BlessingConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PacketUtils } from "../utils/PacketUtils";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { BlessingAnnouncementPacket } from "../../../../Lib/src/packets/announcements/BlessingAnnouncementPacket";
import { MqttTopicUtils } from "../../../../Lib/src/utils/MqttTopicUtils";
import {
	botConfig, crowniclesInstance
} from "../../index";
import {
	datesAreOnSameDay, daysToMilliseconds, getTodayMidnight, getTomorrowMidnight, hoursToMilliseconds, millisecondsToDays, millisecondsToHours, minutesToMilliseconds
} from "../../../../Lib/src/utils/TimeUtils";
import { PlayerMissionsInfo } from "../database/game/models/PlayerMissionsInfo";
import { Op } from "sequelize";
import { DailyMissions } from "../database/game/models/DailyMission";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Players } from "../database/game/models/Player";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Singleton manager for global blessing state.
 * Handles pool contributions, blessing activation, expiry, and dynamic pricing.
 */
export class BlessingManager {
	private static instance: BlessingManager;

	private cachedBlessing: GlobalBlessing | null = null;

	/**
	 * In-memory tracker of contributions per player (keycloakId → total amount)
	 * for the current pool cycle. Resets when a blessing is triggered or pool expires.
	 */
	private contributionsTracker: Map<string, number> = new Map();

	private expiryInterval: ReturnType<typeof setInterval> | null = null;

	static getInstance(): BlessingManager {
		if (!BlessingManager.instance) {
			BlessingManager.instance = new BlessingManager();
		}
		return BlessingManager.instance;
	}

	/**
	 * Initialize the manager by loading state from DB. Should be called on Core startup.
	 */
	async init(): Promise<void> {
		this.cachedBlessing = await GlobalBlessings.get();
		await this.checkForExpiredBlessing();
		await this.checkForExpiredPool();

		// Rebuild contributions tracker from logs DB for the current pool cycle
		await this.rebuildContributionsTracker();

		// Periodically check for expired blessings/pools (every 5 minutes)
		if (this.expiryInterval) {
			clearInterval(this.expiryInterval);
		}
		this.expiryInterval = setInterval(() => {
			this.checkForExpiredBlessing()
				.then(() => this.checkForExpiredPool())
				.catch(e => CrowniclesLogger.errorWithObj("Error in blessing expiry check", e));
		}, minutesToMilliseconds(5));
	}

	/**
	 * Rebuild the in-memory contributions tracker from the logs database.
	 * This ensures contributions are not lost across Core restarts.
	 */
	private async rebuildContributionsTracker(): Promise<void> {
		if (!this.cachedBlessing?.poolStartedAt) {
			return;
		}
		this.contributionsTracker = await crowniclesInstance.logsDatabase.getContributionsSince(
			this.cachedBlessing.poolStartedAt
		);
	}

	/**
	 * Check if no blessing is currently active (missing cache, type NONE, no end date, or expired)
	 */
	private isBlessingInactive(): boolean {
		return !this.cachedBlessing
			|| this.cachedBlessing.activeBlessingType === BlessingType.NONE
			|| !this.cachedBlessing.blessingEndAt
			|| new Date() >= this.cachedBlessing.blessingEndAt;
	}

	/**
	 * Returns the currently active blessing type, or NONE
	 */
	getActiveBlessingType(): BlessingType {
		if (this.isBlessingInactive()) {
			return BlessingType.NONE;
		}
		return this.cachedBlessing!.activeBlessingType as BlessingType;
	}

	/**
	 * Check if a specific blessing type is currently active
	 */
	isActive(type: BlessingType): boolean {
		return this.getActiveBlessingType() === type;
	}

	/**
	 * Check if any blessing is currently active
	 */
	hasActiveBlessing(): boolean {
		return this.getActiveBlessingType() !== BlessingType.NONE;
	}

	/**
	 * Get current pool amount
	 */
	getPoolAmount(): number {
		return this.cachedBlessing?.poolAmount ?? 0;
	}

	/**
	 * Get current pool threshold
	 */
	getPoolThreshold(): number {
		return this.cachedBlessing?.poolThreshold ?? BlessingConstants.INITIAL_POOL_THRESHOLD;
	}

	/**
	 * Get the date when the current pool expires (poolStartedAt + POOL_EXPIRY_DAYS)
	 */
	getPoolExpiresAt(): Date {
		const startedAt = this.cachedBlessing?.poolStartedAt ?? new Date();
		return new Date(startedAt.getTime() + daysToMilliseconds(BlessingConstants.POOL_EXPIRY_DAYS));
	}

	/**
	 * Get blessing end date, if any
	 */
	getBlessingEndAt(): Date | null {
		return this.cachedBlessing?.blessingEndAt ?? null;
	}

	/**
	 * Get the keycloak ID of the player who last triggered a blessing
	 */
	getLastTriggeredByKeycloakId(): string | null {
		return this.cachedBlessing?.lastTriggeredByKeycloakId ?? null;
	}

	/**
	 * Check if a blessing was already triggered today
	 */
	private wasBlessingTriggeredToday(): boolean {
		const lastTriggered = this.cachedBlessing?.lastBlessingTriggeredAt;
		if (!lastTriggered) {
			return false;
		}
		return datesAreOnSameDay(lastTriggered, new Date());
	}

	/**
	 * Check if the oracle small event should appear.
	 * The oracle should NOT appear when:
	 * - A blessing is currently active
	 * - A blessing was already triggered today (max 1 per day)
	 */
	canOracleAppear(): boolean {
		return Boolean(this.cachedBlessing)
			&& !this.hasActiveBlessing()
			&& !this.wasBlessingTriggeredToday();
	}

	/**
	 * Contribute money to the pool. Returns true if the pool was filled and a blessing triggered.
	 */
	async contribute(amount: number, playerKeycloakId: string): Promise<boolean> {
		if (!this.cachedBlessing) {
			return false;
		}

		this.cachedBlessing.poolAmount += amount;

		// Track contribution
		this.contributionsTracker.set(
			playerKeycloakId,
			(this.contributionsTracker.get(playerKeycloakId) ?? 0) + amount
		);

		// Log contribution
		crowniclesInstance.logsDatabase.logBlessingContribution({
			keycloakId: playerKeycloakId,
			amount,
			newPoolAmount: this.cachedBlessing.poolAmount
		}).then();

		if (this.cachedBlessing.poolAmount >= this.cachedBlessing.poolThreshold) {
			// Pool filled! Trigger blessing
			await this.triggerBlessing(playerKeycloakId);
			return true;
		}

		await this.cachedBlessing.save();
		return false;
	}

	/**
	 * Trigger a random blessing when the pool is filled
	 */
	private async triggerBlessing(triggeredByKeycloakId: string): Promise<void> {
		const blessingType = RandomUtils.randInt(1, BlessingConstants.TOTAL_BLESSING_TYPES + 1) as BlessingType;
		let durationHours = RandomUtils.randInt(BlessingConstants.MIN_DURATION_HOURS, BlessingConstants.MAX_DURATION_HOURS + 1);
		let blessingEnd = new Date(Date.now() + hoursToMilliseconds(durationHours));

		// Daily mission blessing must not span across two days to prevent doubling two different daily missions
		if (blessingType === BlessingType.DAILY_MISSION) {
			const endOfToday = getTomorrowMidnight();
			if (blessingEnd > endOfToday) {
				blessingEnd = endOfToday;
				durationHours = Math.max(1, Math.floor(millisecondsToHours(endOfToday.getTime() - Date.now())));
			}
		}

		// Snapshot contribution stats before clearing
		const topContributor = this.getTopContributor();
		const totalContributors = this.contributionsTracker.size;

		// Calculate new threshold using dynamic pricing
		const currentThreshold = this.cachedBlessing!.poolThreshold;
		const fillDurationMs = Date.now() - this.cachedBlessing!.poolStartedAt.getTime();
		const fillDurationDays = millisecondsToDays(fillDurationMs);
		const newThreshold = this.calculateNewThreshold(currentThreshold, fillDurationDays);

		// Update state
		this.cachedBlessing!.activeBlessingType = blessingType;
		this.cachedBlessing!.blessingEndAt = blessingEnd;
		this.cachedBlessing!.lastTriggeredByKeycloakId = triggeredByKeycloakId;
		this.cachedBlessing!.lastBlessingTriggeredAt = new Date();
		this.cachedBlessing!.poolAmount = 0;
		this.cachedBlessing!.poolThreshold = newThreshold;
		this.cachedBlessing!.poolStartedAt = blessingEnd; // Next pool starts when blessing ends
		await this.cachedBlessing!.save();

		// Clear contributions for the new cycle
		this.contributionsTracker.clear();

		// Send announcement
		PacketUtils.announce(
			makePacket(BlessingAnnouncementPacket, {
				blessingType,
				triggeredByKeycloakId,
				durationHours,
				topContributorKeycloakId: topContributor?.keycloakId ?? "",
				topContributorAmount: topContributor?.amount ?? 0,
				totalContributors
			}),
			MqttTopicUtils.getDiscordBlessingAnnouncementTopic(botConfig.PREFIX)
		);

		// Log activation
		crowniclesInstance.logsDatabase.logBlessingActivation({
			blessingType,
			triggeredByKeycloakId,
			poolThreshold: currentThreshold,
			durationHours
		}).then();

		// Apply one-time effects
		if (blessingType === BlessingType.DAILY_MISSION) {
			await this.applyRetroactiveDailyMission();
		}
	}

	/**
	 * Simulate what the new threshold would be if the pool were filled in `fillDurationDays` days.
	 * Uses the current threshold. Useful for testing dynamic pricing.
	 */
	simulateNewThreshold(fillDurationDays: number): number {
		return this.calculateNewThreshold(this.cachedBlessing!.poolThreshold, fillDurationDays);
	}

	/**
	 * Calculate new threshold based on fill duration vs target.
	 * Clamps the change to MAX_THRESHOLD_STEP per cycle to prevent wild jumps.
	 */
	private calculateNewThreshold(currentThreshold: number, fillDurationDays: number): number {
		/*
		 * ratio = targetDuration / actualDuration
		 * Fast fill → ratio > 1 → threshold increases
		 * Slow fill → ratio < 1 → threshold decreases
		 */
		const ratio = BlessingConstants.TARGET_FILL_DAYS / Math.max(fillDurationDays, 0.1);
		let newThreshold = Math.round(currentThreshold * ratio);

		// Clamp the delta to MAX_THRESHOLD_STEP to prevent wild jumps
		const delta = newThreshold - currentThreshold;
		if (Math.abs(delta) > BlessingConstants.MAX_THRESHOLD_STEP) {
			newThreshold = currentThreshold + Math.sign(delta) * BlessingConstants.MAX_THRESHOLD_STEP;
		}

		// Clamp to prevent extreme values
		newThreshold = Math.max(newThreshold, BlessingConstants.MIN_POOL_THRESHOLD);
		newThreshold = Math.min(newThreshold, BlessingConstants.MAX_POOL_THRESHOLD);

		return newThreshold;
	}

	/**
	 * Check for and handle expired blessings (blessing duration over)
	 */
	private async checkForExpiredBlessing(): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}
		if (this.cachedBlessing.activeBlessingType === BlessingType.NONE) {
			return;
		}
		if (!this.cachedBlessing.blessingEndAt || new Date() < this.cachedBlessing.blessingEndAt) {
			return;
		}

		// Blessing expired — reset to collecting state
		const expiredType = this.cachedBlessing.activeBlessingType;
		const expiredThreshold = this.cachedBlessing.poolThreshold;
		this.cachedBlessing.activeBlessingType = BlessingType.NONE;
		this.cachedBlessing.blessingEndAt = null;
		this.cachedBlessing.poolAmount = 0;
		this.cachedBlessing.poolStartedAt = new Date();
		this.contributionsTracker.clear();
		await this.cachedBlessing.save();

		// Log expiration
		crowniclesInstance.logsDatabase.logBlessingExpiration(expiredType, expiredThreshold).then();
	}

	/**
	 * Check for and handle expired pools (4-day timeout without filling)
	 */
	private async checkForExpiredPool(): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}
		if (this.hasActiveBlessing()) {
			return;
		}

		const poolAgeDays = millisecondsToDays(Date.now() - this.cachedBlessing.poolStartedAt.getTime());
		if (poolAgeDays < BlessingConstants.POOL_EXPIRY_DAYS) {
			return;
		}

		// Pool expired without being filled — reset with reduced threshold
		const newThreshold = Math.max(
			Math.round(this.cachedBlessing.poolThreshold * BlessingConstants.EXPIRY_THRESHOLD_MULTIPLIER),
			BlessingConstants.MIN_POOL_THRESHOLD
		);
		this.cachedBlessing.poolAmount = 0;
		this.cachedBlessing.poolThreshold = newThreshold;
		this.cachedBlessing.poolStartedAt = new Date();
		this.contributionsTracker.clear();
		await this.cachedBlessing.save();

		// Log pool expiration
		crowniclesInstance.logsDatabase.logBlessingPoolExpiration(newThreshold).then();
	}

	/**
	 * Get the health potion multiplier (1 = no boost, 2 = x2)
	 */
	getHealthPotionMultiplier(): number {
		return this.isActive(BlessingType.HEAL_ALL) ? BlessingConstants.HEALTH_POTION_MULTIPLIER : 1;
	}

	/**
	 * Effect #9: Apply retroactive daily mission bonus to players who already completed today.
	 * Automatically gives the bonus to all eligible players — no manual claim needed.
	 */
	private async applyRetroactiveDailyMission(): Promise<void> {
		const todayStart = getTodayMidnight();

		const completedToday = await PlayerMissionsInfo.findAll({
			where: {
				lastDailyMissionCompleted: { [Op.gte]: todayStart }
			}
		});

		if (completedToday.length === 0) {
			return;
		}

		const dailyMission = await DailyMissions.getOrGenerate();
		const gemsWon = dailyMission.gemsToWin;
		const xpWon = dailyMission.xpToWin;
		const moneyWon = Math.round(dailyMission.moneyToWin * Constants.MISSIONS.DAILY_MISSION_MONEY_MULTIPLIER);
		const pointsWon = Math.round(dailyMission.pointsToWin * Constants.MISSIONS.DAILY_MISSION_POINTS_MULTIPLIER);

		const players = await Promise.all(completedToday.map(m => Players.getById(m.playerId)));

		await Promise.all(completedToday.map(async (missionInfo, index) => {
			const player = players[index];
			const discardedResponse: CrowniclesPacket[] = [];

			await missionInfo.addGems(gemsWon, player.keycloakId, NumberChangeReason.BLESSING);
			await player.addExperience({
				amount: xpWon,
				response: discardedResponse,
				reason: NumberChangeReason.BLESSING
			});
			await player.addMoney({
				amount: moneyWon,
				response: discardedResponse,
				reason: NumberChangeReason.BLESSING
			});
			await player.addScore({
				amount: pointsWon,
				response: discardedResponse,
				reason: NumberChangeReason.BLESSING
			});
			await player.save();
		}));
	}

	/**
	 * Get the money boost multiplier (1.0 = no boost, 1.1 = +10%)
	 */
	getMoneyMultiplier(): number {
		return this.isActive(BlessingType.MONEY_BOOST) ? 1 + BlessingConstants.MONEY_BOOST_PERCENTAGE : 1;
	}

	/**
	 * Get the score boost multiplier (1.0 = no boost, 1.1 = +10%)
	 */
	getScoreMultiplier(): number {
		return this.isActive(BlessingType.SCORE_BOOST) ? 1 + BlessingConstants.SCORE_BOOST_PERCENTAGE : 1;
	}

	/**
	 * Get the fight loot multiplier (1 = no boost, 4 = x4)
	 */
	getFightLootMultiplier(): number {
		return this.isActive(BlessingType.FIGHT_LOOT) ? BlessingConstants.FIGHT_LOOT_MULTIPLIER : 1;
	}

	/**
	 * Get the energy regen multiplier (1 = no boost, 2 = x2)
	 */
	getEnergyRegenMultiplier(): number {
		return this.isActive(BlessingType.ENERGY_REGEN) ? BlessingConstants.ENERGY_REGEN_MULTIPLIER : 1;
	}

	/**
	 * Get the pet love multiplier (1 = no boost, 2 = x2)
	 */
	getPetLoveMultiplier(): number {
		return this.isActive(BlessingType.PET_LOVE) ? BlessingConstants.PET_LOVE_MULTIPLIER : 1;
	}

	/**
	 * Get the daily mission reward multiplier (1 = no boost, 2 = x2)
	 */
	getDailyMissionMultiplier(): number {
		return this.isActive(BlessingType.DAILY_MISSION) ? BlessingConstants.DAILY_MISSION_MULTIPLIER : 1;
	}

	/**
	 * Check if rage should be amplified (effect #1)
	 */
	isRageAmplified(): boolean {
		return this.isActive(BlessingType.AMPLIFIED_RAGE);
	}

	/**
	 * Check if expedition tokens should have a bonus (effect #8)
	 */
	hasExpeditionTokenBonus(): boolean {
		return this.isActive(BlessingType.EXPEDITION_TOKEN);
	}

	/**
	 * Get the top contributor for the current pool cycle
	 */
	getTopContributor(): {
		keycloakId: string; amount: number;
	} | null {
		if (this.contributionsTracker.size === 0) {
			return null;
		}
		let topKeycloakId = "";
		let topAmount = 0;
		for (const [keycloakId, amount] of this.contributionsTracker) {
			if (amount > topAmount) {
				topKeycloakId = keycloakId;
				topAmount = amount;
			}
		}
		return {
			keycloakId: topKeycloakId, amount: topAmount
		};
	}

	/**
	 * Get the total number of unique contributors for the current pool cycle
	 */
	getTotalContributors(): number {
		return this.contributionsTracker.size;
	}

	// ==================== TEST COMMANDS ====================

	/**
	 * Force activate a specific blessing type (for test commands)
	 */
	async forceActivateBlessing(type: BlessingType, keycloakId: string): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}

		const durationHours = 12;
		const blessingEnd = new Date(Date.now() + hoursToMilliseconds(durationHours));

		this.contributionsTracker.clear();
		this.cachedBlessing.activeBlessingType = type;
		this.cachedBlessing.blessingEndAt = blessingEnd;
		this.cachedBlessing.lastTriggeredByKeycloakId = keycloakId;
		this.cachedBlessing.lastBlessingTriggeredAt = new Date();
		this.cachedBlessing.poolAmount = 0;
		this.cachedBlessing.poolStartedAt = blessingEnd;
		await this.cachedBlessing.save();

		PacketUtils.announce(
			makePacket(BlessingAnnouncementPacket, {
				blessingType: type,
				triggeredByKeycloakId: keycloakId,
				durationHours,
				topContributorKeycloakId: keycloakId,
				topContributorAmount: 0,
				totalContributors: 0
			}),
			MqttTopicUtils.getDiscordBlessingAnnouncementTopic(botConfig.PREFIX)
		);

		// Apply one-time effects
		if (type === BlessingType.DAILY_MISSION) {
			await this.applyRetroactiveDailyMission();
		}
	}

	/**
	 * Force reset the blessing state (for test commands)
	 */
	async forceReset(): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}

		this.cachedBlessing.activeBlessingType = BlessingType.NONE;
		this.cachedBlessing.blessingEndAt = null;
		this.cachedBlessing.poolAmount = 0;
		this.cachedBlessing.poolStartedAt = new Date();
		this.contributionsTracker.clear();
		await this.cachedBlessing.save();
	}

	/**
	 * Force set the pool amount (for test commands)
	 */
	async forceSetPool(amount: number): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}

		this.cachedBlessing.poolAmount = amount;
		await this.cachedBlessing.save();
	}

	/**
	 * Force set the pool threshold (for test commands)
	 */
	async forceSetThreshold(amount: number): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}

		this.cachedBlessing.poolThreshold = amount;
		await this.cachedBlessing.save();
	}

	/**
	 * Force set the pool started at date (for test commands)
	 */
	async forceSetPoolStartedAt(date: Date): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}

		this.cachedBlessing.poolStartedAt = date;
		await this.cachedBlessing.save();
	}
}
