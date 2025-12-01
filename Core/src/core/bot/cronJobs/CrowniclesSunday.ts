import {
	DayOfTheWeek, setWeeklyCronJob
} from "../../utils/CronInterface";
import { Settings } from "../../database/game/models/Setting";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import {
	botConfig, crowniclesInstance
} from "../../../index";
import { makePacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { TopWeekFightAnnouncementPacket } from "../../../../../Lib/src/packets/announcements/TopWeekFightAnnouncementPacket";
import { MqttTopicUtils } from "../../../../../Lib/src/utils/MqttTopicUtils";
import { Badge } from "../../../../../Lib/src/types/Badge";
import Player from "../../database/game/models/Player";
import {
	Op, Sequelize
} from "sequelize";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

export class CrowniclesSunday {
	public static async programCronJob(): Promise<void> {
		await setWeeklyCronJob(CrowniclesSunday.job, await Settings.NEXT_SEASON_RESET.getValue() < Date.now(), DayOfTheWeek.SUNDAY);
	}

	static async job(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error("MQTT is not connected, can't announce the end of the season. Trying again in 1 minute");
			setTimeout(CrowniclesSunday.job, 60000);
			return;
		}

		/*
		 * First program the next season ends immediately at +7 days
		 * Then wait a bit before setting the next date, so we are sure to be past the date
		 *
		 * The first one is set immediately,
		 * so if the bot crashes before programming the next one, it will be set anyway to approximately a valid date
		 * (at 1 s max of difference)
		 */
		await Settings.NEXT_SEASON_RESET.setValue(await Settings.NEXT_SEASON_RESET.getValue() + 7 * 24 * 60 * 60 * 1000);

		crowniclesInstance.logsDatabase.log15BestSeason()
			.then();
		const winner = await CrowniclesSunday.findSeasonWinner();
		if (winner !== null) {
			PacketUtils.announce(makePacket(TopWeekFightAnnouncementPacket, { winnerKeycloakId: winner.keycloakId }), MqttTopicUtils.getDiscordTopWeekFightAnnouncementTopic(botConfig.PREFIX));
			winner.addBadge(Badge.TOP_GLORY);
			await winner.save();
		}
		else {
			PacketUtils.announce(makePacket(TopWeekFightAnnouncementPacket, {}), MqttTopicUtils.getDiscordTopWeekFightAnnouncementTopic(botConfig.PREFIX));
		}
		await CrowniclesSunday.seasonEndQueries();

		CrowniclesLogger.info("Season has been ended !");
		crowniclesInstance.logsDatabase.logSeasonEnd()
			.then();
	}

	/**
	 * Find the winner of the season
	 */
	private static async findSeasonWinner(): Promise<Player> {
		return await Player.findOne({
			where: {
				fightCountdown: {
					[Op.lte]: FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE
				}
			},
			order: [
				[Sequelize.literal("(attackGloryPoints + defenseGloryPoints)"), "DESC"],
				["level", "DESC"],
				["score", "DESC"]
			],
			limit: 1
		});
	}

	/**
	 * Database queries to execute at the end of the season
	 */
	private static async seasonEndQueries(): Promise<void> {
		// We set the gloryPointsLastSeason to 0 if the fightCountdown is above the limit because the player was inactive
		await Player.update(
			{
				gloryPointsLastSeason: Sequelize.literal(
					`CASE WHEN fightCountdown <= ${FightConstants.FIGHT_COUNTDOWN_MAXIMAL_VALUE} THEN attackGloryPoints + defenseGloryPoints ELSE 0 END`
				)
			},
			{ where: {} }
		);

		// We add one to the fightCountdown
		await Player.update(
			{
				fightCountdown: Sequelize.literal(
					"fightCountdown + 1"
				)
			},
			{ where: { fightCountdown: { [Op.lt]: FightConstants.FIGHT_COUNTDOWN_REGEN_LIMIT } } }
		);

		// Transform a part of the defense glory into attack glory
		await Player.update(
			{
				defenseGloryPoints: Sequelize.literal(
					`defenseGloryPoints + LEAST(${FightConstants.ATTACK_GLORY_TO_DEFENSE_GLORY_EACH_WEEK}, attackGloryPoints)`
				),
				attackGloryPoints: Sequelize.literal(
					`attackGloryPoints - LEAST(${FightConstants.ATTACK_GLORY_TO_DEFENSE_GLORY_EACH_WEEK}, attackGloryPoints)`
				)
			},
			{
				where: {
					attackGloryPoints: { [Op.gt]: 0 },
					defenseGloryPoints: { [Op.lte]: FightConstants.MAX_DEFENSE_GLORY_FOR_TRANSFER }
				}
			}
		);
	}
}
