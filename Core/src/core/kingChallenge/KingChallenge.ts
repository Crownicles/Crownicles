import { Op } from "sequelize";
import Player from "../database/game/models/Player";
import PlayerMissionsInfo from "../database/game/models/PlayerMissionsInfo";
import { Settings } from "../database/game/models/Setting";
import { KingChallengeConstants } from "../../../../Lib/src/constants/KingChallengeConstants";
import {
	KingChallengeProgress, KingChallengeReferenceScores, KingChallengeWeekScores
} from "../../../../Lib/src/types/KingChallenge";
import { KingChallengeTierReachedPacket } from "../../../../Lib/src/packets/events/KingChallengeTierReachedPacket";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { getNextSundayMidnight } from "../../../../Lib/src/utils/TimeUtils";
import { bufferUntilCommit } from "../../../../Lib/src/locks/scheduleAfterCommit";
import { getCurrentTransaction } from "../../../../Lib/src/locks/CLSNamespace";

/**
 * The thresholds only change on the weekly reset, they are computed once and kept until then.
 * The promise is cached rather than its value so concurrent first reads share a single database read.
 */
let cachedThresholds: Promise<number[]> | null = null;

function parseReferenceScores(serializedScores: string): number[] {
	return serializedScores.split(",")
		.map(Number)
		.filter(score => Number.isFinite(score) && score > 0);
}

/**
 * @param underShareLock Read the latest committed scores and keep them from changing until the current transaction ends
 */
async function getReferenceScores(underShareLock = false): Promise<KingChallengeReferenceScores> {
	const read = (setting: typeof Settings.KING_CHALLENGE_REFERENCE_SCORES): Promise<string> =>
		underShareLock ? setting.getValueUnderShareLock() : setting.getValue();
	return {
		ladder: parseReferenceScores(await read(Settings.KING_CHALLENGE_REFERENCE_SCORES)),
		champion: parseReferenceScores(await read(Settings.KING_CHALLENGE_CHAMPION_SCORES))
	};
}

/**
 * Weekly score required by each tier of the current week's king's challenge.
 * Cached, so it can lag behind the weekly reset for a moment: use it for display and quick checks only.
 */
export async function getKingChallengeThresholds(): Promise<number[]> {
	if (cachedThresholds) {
		return cachedThresholds;
	}
	if (getCurrentTransaction()) {
		// Not cached: the snapshot of the caller's transaction may predate the last weekly reset
		return KingChallengeConstants.computeThresholds(await getReferenceScores());
	}
	const thresholds = getReferenceScores()
		.then(referenceScores => KingChallengeConstants.computeThresholds(referenceScores));
	cachedThresholds = thresholds;
	thresholds.catch(() => {
		// A failed read must not stick for the whole week
		if (cachedThresholds === thresholds) {
			cachedThresholds = null;
		}
	});
	return await thresholds;
}

/**
 * Pay the tiers reached by a locked player since their last rewarded tier, and announce the crossing in the response
 */
async function rewardKingChallengeTiersUnderLock(lockedPlayer: Locked<Player>, response: CrowniclesPacket[]): Promise<void> {
	/*
	 * Not the cached thresholds: the weekly reset commits the reset of the weekly scores together with the reference
	 * scores of the new week, so this locked read always matches the week of the locked weekly score
	 */
	const thresholds = KingChallengeConstants.computeThresholds(await getReferenceScores(true));
	const previousTier = lockedPlayer.kingChallengeTier;
	const reachedTier = KingChallengeConstants.getReachedTier(lockedPlayer.weeklyScore, thresholds);
	if (reachedTier <= previousTier) {
		return;
	}

	// Persisted before granting anything: a score gained from these rewards (e.g. a completed mission) must not pay the same tiers again
	lockedPlayer.kingChallengeTier = reachedTier;
	await lockedPlayer.save();

	// Only announced once the rewards are committed: a failed write rolls them back with the tier
	await bufferUntilCommit(response, async rewardResponse => {
		/*
		 * Built before granting anything: the rewards can complete a mission whose points cross the next tier,
		 * which would make the remaining points of this crossing negative. It is also announced before those missions.
		 * The tokens are only granted below the cap, so the announced amount is the one the cap lets through, and they are
		 * credited first so that a next tier crossed by the missions of the other rewards counts them in its owned tokens.
		 */
		const tierRewards = KingChallengeConstants.sumRewards(previousTier, reachedTier);
		const reward = {
			...tierRewards,
			tokens: lockedPlayer.getTokenGain(tierRewards.tokens, NumberChangeReason.KING_CHALLENGE)
		};
		rewardResponse.push(makePacket(KingChallengeTierReachedPacket, {
			keycloakId: lockedPlayer.keycloakId,
			tier: reachedTier,
			crossedTiers: reachedTier - previousTier,
			reward,
			...reachedTier < thresholds.length ? { pointsToNextTier: thresholds[reachedTier] - lockedPlayer.weeklyScore } : {},
			ownedTokens: lockedPlayer.tokens + reward.tokens
		}));

		if (reward.tokens > 0) {
			await lockedPlayer.addTokens({
				response: rewardResponse,
				amount: reward.tokens,
				reason: NumberChangeReason.KING_CHALLENGE
			});
		}
		await lockedPlayer.addMoney({
			response: rewardResponse,
			amount: reward.money,
			reason: NumberChangeReason.KING_CHALLENGE,
			ignoreBlessing: true
		});
		if (reward.gems > 0) {
			await PlayerMissionsInfo.withLocked(lockedPlayer.id, lockedMissionsInfo => lockedMissionsInfo.addGems(reward.gems, lockedPlayer.keycloakId, NumberChangeReason.KING_CHALLENGE));
		}
	});
}

/**
 * Reward the king's challenge tiers newly reached by a locked player. Called after each weekly score change,
 * in the critical section of the change, so a weekly reset cannot slip between a gain and its reward.
 * @param lockedPlayer
 * @param response
 */
export async function applyKingChallengeProgressUnderLock(lockedPlayer: Locked<Player>, response: CrowniclesPacket[]): Promise<void> {
	/*
	 * Quick check against the cached thresholds, which can only defer a reward to the next gain if they lag behind the reset.
	 * It keeps most score changes from locking the reference scores, which the weekly reset has to wait for.
	 */
	const thresholds = await getKingChallengeThresholds();
	if (KingChallengeConstants.getReachedTier(lockedPlayer.weeklyScore, thresholds) > lockedPlayer.kingChallengeTier) {
		await rewardKingChallengeTiersUnderLock(lockedPlayer, response);
	}
}

/**
 * Progress of the player in the current week's king's challenge
 * @param player
 */
export async function getKingChallengeProgress(player: Player): Promise<KingChallengeProgress> {
	return {
		weeklyScore: player.weeklyScore,
		tier: player.kingChallengeTier,
		thresholds: await getKingChallengeThresholds(),

		// NEXT_WEEKLY_RESET only catches up a missed reset at startup, the reset itself runs every Monday at midnight
		nextResetDate: getNextSundayMidnight()
	};
}

/**
 * Weekly scores of the best player and of the reference rank for the week ending, or null if too few players scored.
 * Must run before the weekly reset.
 */
export async function getWeeklyReferenceScores(): Promise<KingChallengeWeekScores | null> {
	const bestPlayers = await Player.findAll({
		attributes: ["weeklyScore"],
		where: { weeklyScore: { [Op.gt]: 0 } },
		order: [["weeklyScore", "DESC"]],
		limit: KingChallengeConstants.REFERENCE_RANK
	});
	if (bestPlayers.length < KingChallengeConstants.REFERENCE_RANK) {
		return null;
	}
	return {
		ladder: bestPlayers[KingChallengeConstants.REFERENCE_RANK - 1].weeklyScore,
		champion: bestPlayers[0].weeklyScore
	};
}

/**
 * Start a new week of the king's challenge: reset the weekly scores with the rewarded tiers, and add the scores
 * of the week ending to the history, which sets the thresholds of the new week.
 * Both are committed together, so a score gain never sees the scores of one week with the thresholds of another.
 * @param weekScores Scores of the week ending, read before calling this, or null to keep the current thresholds
 */
export async function startNewKingChallengeWeek(weekScores: KingChallengeWeekScores | null): Promise<void> {
	try {
		await Player.sequelize!.transaction(async () => {
			// The players are locked before the reference scores, in the same order as the score gains, so they cannot deadlock
			await Player.update({
				weeklyScore: 0,
				kingChallengeTier: 0
			}, { where: {} });
			if (weekScores === null) {
				return;
			}
			const referenceScores = KingChallengeConstants.pushReferenceScores(await getReferenceScores(true), weekScores);
			await Settings.KING_CHALLENGE_REFERENCE_SCORES.setValue(referenceScores.ladder.join(","));
			await Settings.KING_CHALLENGE_CHAMPION_SCORES.setValue(referenceScores.champion.join(","));
		});
	}
	finally {
		cachedThresholds = null;
	}
}
