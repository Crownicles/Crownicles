import {
	DayOfTheWeek, setWeeklyCronJob
} from "../../utils/CronInterface";
import { Settings } from "../../database/game/models/Setting";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import {
	botConfig, crowniclesInstance
} from "../../../index";
import Player from "../../database/game/models/Player";
import { Op } from "sequelize";
import { makePacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { TopWeekAnnouncementPacket } from "../../../../../Lib/src/packets/announcements/TopWeekAnnouncementPacket";
import { MqttTopicUtils } from "../../../../../Lib/src/utils/MqttTopicUtils";
import { Badge } from "../../../../../Lib/src/types/Badge";
import PlayerMissionsInfo from "../../database/game/models/PlayerMissionsInfo";
import { MapCache } from "../../maps/MapCache";

export class CrowniclesMonday {
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
		await Settings.NEXT_WEEKLY_RESET.setValue(await Settings.NEXT_WEEKLY_RESET.getValue() + 7 * 24 * 60 * 60 * 1000);
		CrowniclesMonday.topWeekEnd()
			.then();
		CrowniclesMonday.newPveIsland()
			.then();
	}

	/**
	 * End the top week
	 */
	static async topWeekEnd(): Promise<void> {
		crowniclesInstance?.logsDatabase.log15BestTopWeek()
			.then();
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
		if (winner !== null) {
			PacketUtils.announce(makePacket(TopWeekAnnouncementPacket, { winnerKeycloakId: winner.keycloakId }), MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(botConfig.PREFIX));
			winner.addBadge(Badge.TOP_WEEK);
			await winner.save();
		}
		else {
			PacketUtils.announce(makePacket(TopWeekAnnouncementPacket, {}), MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(botConfig.PREFIX));
		}
		await Player.update({ weeklyScore: 0 }, { where: {} });
		CrowniclesLogger.info("Weekly leaderboard has been reset !");
		await PlayerMissionsInfo.resetShopBuyout();
		CrowniclesLogger.info("All players can now buy again points from the mission shop !");
		crowniclesInstance?.logsDatabase.logTopWeekEnd()
			.then();
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
