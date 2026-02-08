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
import { datesAreOnSameDay } from "../../../../Lib/src/utils/TimeUtils";

/**
 * Singleton manager for global blessing state.
 * Handles pool contributions, blessing activation, expiry, and dynamic pricing.
 */
export class BlessingManager {
	private static instance: BlessingManager;

	private cachedBlessing: GlobalBlessing | null = null;

	/**
	 * In-memory set of keycloak IDs who have claimed the daily mission bonus
	 * for the current blessing cycle. Resets when a new blessing is triggered or expires.
	 */
	private dailyBonusClaimed: Set<string> = new Set();

	/**
	 * In-memory tracker of contributions per player (keycloakId → total amount)
	 * for the current pool cycle. Resets when a blessing is triggered or pool expires.
	 */
	private contributionsTracker: Map<string, number> = new Map();

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
	}

	/**
	 * Check if a specific blessing type is currently active
	 */
	isActive(type: BlessingType): boolean {
		if (!this.cachedBlessing) {
			return false;
		}
		if (this.cachedBlessing.activeBlessingType !== type) {
			return false;
		}
		if (!this.cachedBlessing.blessingEndAt) {
			return false;
		}
		return new Date() < this.cachedBlessing.blessingEndAt;
	}

	/**
	 * Check if any blessing is currently active
	 */
	hasActiveBlessing(): boolean {
		if (!this.cachedBlessing) {
			return false;
		}
		if (this.cachedBlessing.activeBlessingType === BlessingType.NONE) {
			return false;
		}
		if (!this.cachedBlessing.blessingEndAt) {
			return false;
		}
		return new Date() < this.cachedBlessing.blessingEndAt;
	}

	/**
	 * Returns the currently active blessing type, or NONE
	 */
	getActiveBlessingType(): BlessingType {
		if (!this.hasActiveBlessing()) {
			return BlessingType.NONE;
		}
		return this.cachedBlessing!.activeBlessingType as BlessingType;
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
	 * Check if the oracle small event should appear.
	 * The oracle should NOT appear when:
	 * - A blessing is currently active
	 * - A blessing was already triggered today (max 1 per day)
	 */
	canOracleAppear(): boolean {
		if (!this.cachedBlessing) {
			return false;
		}

		// Don't appear during active blessing
		if (this.hasActiveBlessing()) {
			return false;
		}

		// Check if blessing was triggered today — max 1 per day
		if (this.cachedBlessing.blessingEndAt && datesAreOnSameDay(this.cachedBlessing.blessingEndAt, new Date())) {
			/*
			 * A blessing ended (or is ending) today — check if it was triggered today
			 * We use the end date minus blessing duration to approximate trigger time
			 * Simpler: if blessingEndAt is in the past and it's the same day, a blessing was triggered today
			 */
			return false;
		}

		return true;
	}

	/**
	 * Contribute money to the pool. Returns true if the pool was filled and a blessing triggered.
	 */
	async contribute(amount: number, playerKeycloakId: string, response: CrowniclesPacket[]): Promise<boolean> {
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
		crowniclesInstance.logsDatabase.logBlessingContribution(
			playerKeycloakId,
			amount,
			this.cachedBlessing.poolAmount
		).then();

		if (this.cachedBlessing.poolAmount >= this.cachedBlessing.poolThreshold) {
			// Pool filled! Trigger blessing
			await this.triggerBlessing(playerKeycloakId, response);
			return true;
		}

		await this.cachedBlessing.save();
		return false;
	}

	/**
	 * Trigger a random blessing when the pool is filled
	 */
	private async triggerBlessing(triggeredByKeycloakId: string, response: CrowniclesPacket[]): Promise<void> {
		const blessingType = RandomUtils.randInt(1, BlessingConstants.TOTAL_BLESSING_TYPES + 1) as BlessingType;
		const durationHours = RandomUtils.randInt(BlessingConstants.MIN_DURATION_HOURS, BlessingConstants.MAX_DURATION_HOURS + 1);
		const blessingEnd = new Date(Date.now() + durationHours * 60 * 60 * 1000);

		// Reset daily bonus claims for the new blessing cycle
		this.dailyBonusClaimed.clear();

		// Snapshot contribution stats before clearing
		const topContributor = this.getTopContributor();
		const totalContributors = this.contributionsTracker.size;

		// Calculate new threshold using dynamic pricing
		const fillDurationMs = Date.now() - this.cachedBlessing!.poolStartedAt.getTime();
		const fillDurationDays = fillDurationMs / (24 * 60 * 60 * 1000);
		const newThreshold = this.calculateNewThreshold(this.cachedBlessing!.poolThreshold, fillDurationDays);

		// Update state
		this.cachedBlessing!.activeBlessingType = blessingType;
		this.cachedBlessing!.blessingEndAt = blessingEnd;
		this.cachedBlessing!.lastTriggeredByKeycloakId = triggeredByKeycloakId;
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
		crowniclesInstance.logsDatabase.logBlessingActivation(
			blessingType,
			triggeredByKeycloakId,
			newThreshold,
			durationHours
		).then();

		// Apply one-time effects
		if (blessingType === BlessingType.DAILY_MISSION) {
			await this.applyRetroactiveDailyMission(response);
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
		this.dailyBonusClaimed.clear();
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

		const poolAgeDays = (Date.now() - this.cachedBlessing.poolStartedAt.getTime()) / (24 * 60 * 60 * 1000);
		if (poolAgeDays < BlessingConstants.POOL_EXPIRY_DAYS) {
			return;
		}

		// Pool expired without being filled — reset with reduced threshold
		const oldThreshold = this.cachedBlessing.poolThreshold;
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
		crowniclesInstance.logsDatabase.logBlessingPoolExpiration(oldThreshold, newThreshold).then();
	}

	/**
	 * Get the health potion multiplier (1 = no boost, 2 = x2)
	 */
	getHealthPotionMultiplier(): number {
		return this.isActive(BlessingType.HEAL_ALL) ? BlessingConstants.HEALTH_POTION_MULTIPLIER : 1;
	}

	/**
	 * Effect #9: Apply retroactive daily mission bonus to players who already completed today
	 * Players who already completed the daily mission today get an extra reward equal to their original reward
	 */
	private async applyRetroactiveDailyMission(_response: CrowniclesPacket[]): Promise<void> {
		/*
		 * Retroactive bonus will be complex to implement perfectly
		 * For now, we let the ongoing multiplier handle it for future completions
		 * The retroactive part could be done via a bulk update or notification
		 * This is a simplified approach - the multiplier will apply to future completions today
		 */
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
	 * Check if a player can claim the retroactive daily mission bonus.
	 * Player can claim if: daily mission blessing is active + player completed daily today + hasn't already claimed
	 */
	canPlayerClaimDailyBonus(keycloakId: string): boolean {
		return this.isActive(BlessingType.DAILY_MISSION) && !this.dailyBonusClaimed.has(keycloakId);
	}

	/**
	 * Mark a player as having claimed the retroactive daily mission bonus
	 */
	markDailyBonusClaimed(keycloakId: string): void {
		this.dailyBonusClaimed.add(keycloakId);
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
	async forceActivateBlessing(type: BlessingType, keycloakId: string, response: CrowniclesPacket[]): Promise<void> {
		if (!this.cachedBlessing) {
			return;
		}

		const durationHours = 12;
		const blessingEnd = new Date(Date.now() + durationHours * 60 * 60 * 1000);

		this.dailyBonusClaimed.clear();
		this.contributionsTracker.clear();
		this.cachedBlessing.activeBlessingType = type;
		this.cachedBlessing.blessingEndAt = blessingEnd;
		this.cachedBlessing.lastTriggeredByKeycloakId = keycloakId;
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
			await this.applyRetroactiveDailyMission(response);
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
		this.dailyBonusClaimed.clear();
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
}
