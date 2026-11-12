import { setWeeklyCronJob } from "../../utils/CronInterface";
import { DayOfTheWeek } from "../../../../../Lib/src/constants/TimeConstants";
import { Settings } from "../../database/game/models/Setting";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { botConfig } from "../../../bootstrap";
import { crowniclesInstance } from "../../../app";
import Player, { Players } from "../../database/game/models/Player";
import {
	DatabaseError, Op
} from "sequelize";
import { makePacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { TopWeekAnnouncementPacket } from "../../../../../Lib/src/packets/announcements/TopWeekAnnouncementPacket";
import { MqttTopicUtils } from "../../../../../Lib/src/utils/MqttTopicUtils";
import { Badge } from "../../../../../Lib/src/types/Badge";
import {
	asMinutes, asWeeks, minutesToMilliseconds, weeksToMilliseconds
} from "../../../../../Lib/src/utils/TimeUtils";
import { KingChallengeWeekScores } from "../../../../../Lib/src/types/KingChallenge";
import PlayerMissionsInfo from "../../database/game/models/PlayerMissionsInfo";
import { MapCache } from "../../maps/MapCache";
import { PlayerBadgesManager } from "../../database/game/models/PlayerBadges";
import {
	getKingChallengeThresholds, getWeeklyReferenceScores, startNewKingChallengeWeek
} from "../../kingChallenge/KingChallenge";

/**
 * Raised by a statement of the weekly reset, so before its commit: the reset is rolled back and retrying it cannot apply it twice.
 * Other errors, like a connection lost during the commit, leave its outcome unknown and are not retried.
 */
const ROLLED_BACK_RESET_ERROR_CODES: ReadonlySet<string> = new Set([
	"ER_LOCK_DEADLOCK",
	"ER_LOCK_WAIT_TIMEOUT",
	"ER_CHECKREAD"
]);

function isRolledBackResetError(error: unknown): boolean {
	return error instanceof DatabaseError && ROLLED_BACK_RESET_ERROR_CODES.has((error.parent as Error & { code?: string }).code ?? "");
}

export class CrowniclesMonday {
	/**
	 * The next weekly reset is already programmed when this one runs: a failed attempt left as is would carry
	 * the weekly scores and the king's challenge over a whole week
	 */
	static readonly WEEK_RESET_MAX_ATTEMPTS = 5;

	/** Longer than the lock wait timeout of the database, so a long held player row is likely released */
	static readonly WEEK_RESET_RETRY_DELAY_MS = minutesToMilliseconds(asMinutes(1));

	public static async programCronJob(): Promise<void> {
		await setWeeklyCronJob(CrowniclesMonday.job, await Settings.NEXT_WEEKLY_RESET.getValue() < Date.now(), DayOfTheWeek.MONDAY);
	}

	static async job(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error("MQTT is not connected, can't announce the end of the week. Trying again in 1 minute");
			setTimeout(CrowniclesMonday.job, 60000);
			return;
		}

		/*
		 * First program the next weekly end immediately at +7 days
		 * Then wait a bit before setting the next date, so we are sure to be past the date
		 *
		 * The first one is set immediately so if the bot crashes before programming the next one, it will be set anyway to approximately a valid date (at 1s max of difference)
		 */
		await Settings.NEXT_WEEKLY_RESET.setValue(await Settings.NEXT_WEEKLY_RESET.getValue() + weeksToMilliseconds(asWeeks(1)));
		CrowniclesMonday.topWeekEnd()
			.then();
		CrowniclesMonday.newPveIsland()
			.then();
	}

	/**
	 * End the top week
	 */
	static async topWeekEnd(): Promise<void> {
		// The best players must be logged before their weekly score is reset
		await crowniclesInstance?.logsDatabase.log15BestTopWeek()
			.catch(error => CrowniclesLogger.errorWithObj("Failed to log the 15 best players of the top week", error));
		const winner = await Player.findOne({
			where: {
				weeklyScore: { [Op.gt]: 100 }
			},
			order: [
				["weeklyScore", "DESC"],
				["level", "DESC"]
			],
			limit: 1
		});
		const referenceScores = await getWeeklyReferenceScores();
		if (winner !== null) {
			PacketUtils.announce(makePacket(TopWeekAnnouncementPacket, { winnerKeycloakId: winner.keycloakId }), MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(botConfig.PREFIX));
			await PlayerBadgesManager.addBadge(winner.id, Badge.TOP_WEEK);
		}
		else {
			PacketUtils.announce(makePacket(TopWeekAnnouncementPacket, {}), MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(botConfig.PREFIX));
		}
		await CrowniclesMonday.startNewWeek(referenceScores);
		CrowniclesLogger.info("Weekly leaderboard has been reset !");
		CrowniclesLogger.info("King's challenge week ended", {
			referenceScores,
			nextThresholds: await getKingChallengeThresholds()
		});
		await PlayerMissionsInfo.resetShopBuyout();
		CrowniclesLogger.info("All players can now buy again points from the mission shop !");
		await Players.resetTimePotionsCookedThisWeek();
		CrowniclesLogger.info("All players can cook time potions again");
		crowniclesInstance?.logsDatabase.logTopWeekEnd()
			.then();
	}

	/**
	 * Reset the weekly scores and start the new week of the king's challenge, retrying an attempt surely rolled back
	 * @param referenceScores
	 */
	private static async startNewWeek(referenceScores: KingChallengeWeekScores | null): Promise<void> {
		for (let attempt = 1; ; attempt++) {
			try {
				await startNewKingChallengeWeek(referenceScores);
				return;
			}
			catch (error) {
				if (attempt >= CrowniclesMonday.WEEK_RESET_MAX_ATTEMPTS || !isRolledBackResetError(error)) {
					throw error;
				}
				CrowniclesLogger.errorWithObj(`The weekly reset failed (attempt ${attempt}/${CrowniclesMonday.WEEK_RESET_MAX_ATTEMPTS}), retrying`, error);
				await new Promise(resolve => setTimeout(resolve, CrowniclesMonday.WEEK_RESET_RETRY_DELAY_MS));
			}
		}
	}

	/**
	 * Choose a new pve island
	 */
	static async newPveIsland(): Promise<void> {
		const newMapLink = MapCache.randomPveBoatLinkId(await Settings.PVE_ISLAND.getValue());
		CrowniclesLogger.info("New pve island map link of the week", { newMapLink });
		await Settings.PVE_ISLAND.setValue(newMapLink);
	}
}
