import {
	setYearlyCronJob, shouldRunYearlyEventImmediately
} from "../../utils/CronInterface";
import { Settings } from "../../database/game/models/Setting";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { botConfig } from "../../../bootstrap";
import { makePacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ChristmasBonusAnnouncementPacket } from "../../../../../Lib/src/packets/announcements/ChristmasBonusAnnouncementPacket";
import { MqttTopicUtils } from "../../../../../Lib/src/utils/MqttTopicUtils";
import Player from "../../database/game/models/Player";
import { TokensConstants } from "../../../../../Lib/src/constants/TokensConstants";
import { TimeoutFunctionsConstants } from "../../../../../Lib/src/constants/TimeoutFunctionsConstants";
import { ChristmasConstants } from "../../../../../Lib/src/constants/ChristmasConstants";
import { hoursToMilliseconds } from "../../../../../Lib/src/utils/TimeUtils";

export class CrowniclesChristmas {
	/**
	 * Program the yearly Christmas events (both on December 25th: pre-announcement at 12:00, bonus at 16:00)
	 */
	public static async programCronJob(): Promise<void> {
		// Check if we already applied the bonus this year before deciding to run immediately
		const currentYear = new Date().getFullYear();
		const lastBonusYear = await Settings.LAST_CHRISTMAS_BONUS_YEAR.getValue();
		const alreadyDoneThisYear = lastBonusYear >= currentYear;

		const shouldRunPreAnnouncement = !alreadyDoneThisYear && shouldRunYearlyEventImmediately(ChristmasConstants.PRE_ANNOUNCEMENT_SCHEDULE);
		const shouldRunBonus = !alreadyDoneThisYear && shouldRunYearlyEventImmediately(ChristmasConstants.BONUS_SCHEDULE);

		if (alreadyDoneThisYear) {
			CrowniclesLogger.info(`Christmas bonus already applied for year ${currentYear}, skipping immediate execution`);
		}

		await setYearlyCronJob(
			CrowniclesChristmas.christmasPreAnnouncement,
			shouldRunPreAnnouncement,
			ChristmasConstants.PRE_ANNOUNCEMENT_SCHEDULE
		);

		// If both events should run immediately, delay the bonus by a few hours after the announcement
		if (shouldRunPreAnnouncement && shouldRunBonus) {
			CrowniclesLogger.info(`Christmas bonus will be applied in ${ChristmasConstants.IMMEDIATE_DELAY_HOURS} hours (delayed from immediate execution)`);
			setTimeout(CrowniclesChristmas.christmasBonus, hoursToMilliseconds(ChristmasConstants.IMMEDIATE_DELAY_HOURS));

			// Still set up the yearly cron for future years, but don't run immediately
			await setYearlyCronJob(
				CrowniclesChristmas.christmasBonus,
				false, // Don't run immediately, we already scheduled it with setTimeout
				ChristmasConstants.BONUS_SCHEDULE
			);
		}
		else {
			await setYearlyCronJob(
				CrowniclesChristmas.christmasBonus,
				shouldRunBonus,
				ChristmasConstants.BONUS_SCHEDULE
			);
		}
	}

	/**
	 * Send a pre-announcement for the Christmas bonus (a few hours before)
	 */
	static christmasPreAnnouncement(): void {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error("MQTT is not connected, can't announce Christmas bonus. Trying again in 1 minute");
			setTimeout(CrowniclesChristmas.christmasPreAnnouncement, TimeoutFunctionsConstants.MQTT_RETRY_DELAY);
			return;
		}

		CrowniclesLogger.info("Sending Christmas pre-announcement...");
		PacketUtils.announce(
			makePacket(ChristmasBonusAnnouncementPacket, { isPreAnnouncement: true }),
			MqttTopicUtils.getDiscordChristmasBonusAnnouncementTopic(botConfig.PREFIX)
		);
	}

	/**
	 * Apply the Christmas bonus: set all players' tokens to max and announce it
	 */
	static async christmasBonus(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error("MQTT is not connected, can't apply Christmas bonus. Trying again in 1 minute");
			setTimeout(CrowniclesChristmas.christmasBonus, TimeoutFunctionsConstants.MQTT_RETRY_DELAY);
			return;
		}

		// Check if we already applied the bonus this year
		const currentYear = new Date().getFullYear();
		const lastBonusYear = await Settings.LAST_CHRISTMAS_BONUS_YEAR.getValue();
		if (lastBonusYear >= currentYear) {
			CrowniclesLogger.info(`Christmas bonus already applied for year ${currentYear}, skipping...`);
			return;
		}

		CrowniclesLogger.info("Applying Christmas token bonus to all players...");

		// Set all players' tokens to maximum
		await Player.update(
			{ tokens: TokensConstants.MAX },
			{ where: {} }
		);

		// Save the year to prevent duplicate execution
		await Settings.LAST_CHRISTMAS_BONUS_YEAR.setValue(currentYear);

		// Announce the bonus
		PacketUtils.announce(
			makePacket(ChristmasBonusAnnouncementPacket, { isPreAnnouncement: false }),
			MqttTopicUtils.getDiscordChristmasBonusAnnouncementTopic(botConfig.PREFIX)
		);

		CrowniclesLogger.info("Christmas token bonus applied to all players!");
	}
}
