import { PacketListenerServer } from "../../../../Lib/src/packets/PacketListener";
import { GameDatabase } from "../database/game/GameDatabase";
import { LogsDatabase } from "../database/logs/LogsDatabase";
import { botConfig } from "../../index";
import {
	Op, Sequelize
} from "sequelize";
import { minutesToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";
import { TimeoutFunctionsConstants } from "../../../../Lib/src/constants/TimeoutFunctionsConstants";
import { MapCache } from "../maps/MapCache";
import { registerAllPacketHandlers } from "../packetHandlers/PacketHandler";
import { CommandsTest } from "../CommandsTest";
import Player from "../database/game/models/Player";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { PacketUtils } from "../utils/PacketUtils";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ScheduledReportNotifications } from "../database/game/models/ScheduledReportNotification";
import { ReachDestinationNotificationPacket } from "../../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { MapLocationDataController } from "../../data/MapLocation";

// skipcq: JS-C1003 - fs does not expose itself as an ES Module.
import * as fs from "fs";
import { initializeAllClassBehaviors } from "../fights/AiBehaviorController";
import { initializeAllPetBehaviors } from "../fights/PetAssistManager";
import { CrowniclesCoreWebServer } from "./CrowniclesCoreWebServer";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { FightsManager } from "../fights/FightsManager";
import { EnergyFullNotificationPacket } from "../../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import { DailyBonusNotificationPacket } from "../../../../Lib/src/packets/notifications/DailyBonusNotificationPacket";
import { ScheduledDailyBonusNotifications } from "../database/game/models/ScheduledDailyBonusNotification";
import { CrowniclesDaily } from "./cronJobs/CrowniclesDaily";
import { CrowniclesSunday } from "./cronJobs/CrowniclesSunday";
import { CrowniclesMonday } from "./cronJobs/CrowniclesMonday";

export class Crownicles {
	public readonly packetListener: PacketListenerServer;

	public readonly gameDatabase: GameDatabase;

	public readonly logsDatabase: LogsDatabase;

	constructor() {
		// Register commands
		this.packetListener = new PacketListenerServer();

		// Databases
		this.gameDatabase = new GameDatabase();
		this.logsDatabase = new LogsDatabase();
	}

	/**
	 * Update the fight points of the entities that lost some
	 */
	static async fightPowerRegenerationLoop(): Promise<void> {
		const notifications = await Player.findAll(
			{
				where: {
					[Op.and]: [
						{ fightPointsLost: { [Op.lte]: FightConstants.POINTS_REGEN_AMOUNT } },
						{ fightPointsLost: { [Op.ne]: 0 } },
						{ mapLinkId: { [Op.in]: MapCache.regenEnergyMapLinks } }
					]
				}
			}
		);

		if (notifications.length > 0) {
			PacketUtils.sendNotifications(notifications.map(notification => makePacket(EnergyFullNotificationPacket, {
				keycloakId: notification.keycloakId
			})));
		}

		Player.update(
			{
				fightPointsLost: Sequelize.literal(
					`CASE WHEN fightPointsLost - ${FightConstants.POINTS_REGEN_AMOUNT} < 0 THEN 0 ELSE fightPointsLost - ${FightConstants.POINTS_REGEN_AMOUNT} END`
				)
			},
			{
				where: {
					fightPointsLost: { [Op.not]: 0 },
					mapLinkId: { [Op.in]: MapCache.regenEnergyMapLinks }
				}
			}
		)
			.finally(() => null);
		setTimeout(
			Crownicles.fightPowerRegenerationLoop,
			minutesToMilliseconds(FightConstants.POINTS_REGEN_MINUTES)
		);
	}

	static async reportNotifications(): Promise<void> {
		if (PacketUtils.isMqttConnected()) {
			const notifications = await ScheduledReportNotifications.getNotificationsBeforeDate(new Date());
			if (notifications.length !== 0) {
				PacketUtils.sendNotifications(notifications.map(notification => makePacket(ReachDestinationNotificationPacket, {
					keycloakId: notification.keycloakId,
					mapType: MapLocationDataController.instance.getById(notification.mapId).type,
					mapId: notification.mapId
				})));
				await ScheduledReportNotifications.bulkDelete(notifications);
			}
		}
		else {
			CrowniclesLogger.error(`MQTT is not connected, can't do report notifications. Trying again in ${TimeoutFunctionsConstants.REPORT_NOTIFICATIONS} ms`);
		}

		setTimeout(Crownicles.reportNotifications, TimeoutFunctionsConstants.REPORT_NOTIFICATIONS);
	}

	static async dailyBonusNotifications(): Promise<void> {
		if (PacketUtils.isMqttConnected()) {
			const notifications = await ScheduledDailyBonusNotifications.getNotificationsBeforeDate(new Date());
			if (notifications.length !== 0) {
				PacketUtils.sendNotifications(notifications.map(notification => makePacket(DailyBonusNotificationPacket, {
					keycloakId: notification.keycloakId
				})));
				await ScheduledDailyBonusNotifications.bulkDelete(notifications);
			}
		}
		else {
			CrowniclesLogger.error(`MQTT is not connected, can't do daily bonus notifications. Trying again in ${TimeoutFunctionsConstants.DAILY_TIMEOUT} ms`);
		}

		setTimeout(Crownicles.dailyBonusNotifications, TimeoutFunctionsConstants.DAILY_TIMEOUT);
	}


	/**
	 * Sets the maintenance mode of the bot
	 * @param enable
	 * @param saveToConfig Save the maintenance state to the config file
	 * @throws
	 */
	public setMaintenance(enable: boolean, saveToConfig: boolean): void {
		// Do it before setting the maintenance mode: if it fails, the mode will not be changed
		if (saveToConfig) {
			// Read the config file
			const currentConfig = fs.readFileSync(`${process.cwd()}/config/config.toml`, "utf-8");
			const regexMaintenance = /(maintenance *= *)(true|false)/g;

			// Search for the maintenance field
			if (regexMaintenance.test(currentConfig)) {
				// Replace the value of the field. $1 is the group without true or false
				const newConfig = currentConfig.replace(regexMaintenance, `$1${enable}`);

				// Write the config
				fs.writeFileSync(`${process.cwd()}/config/config.toml`, newConfig, "utf-8");
			}
			else {
				throw new Error("Unable to get the maintenance field in the config file");
			}
		}

		botConfig.MODE_MAINTENANCE = enable;
	}

	async init(): Promise<void> {
		CrowniclesCoreWebServer.start();
		await registerAllPacketHandlers();
		initializeAllClassBehaviors();
		initializeAllPetBehaviors();
		await this.gameDatabase.init(true);
		await this.logsDatabase.init(true);
		await MapCache.init();
		FightsManager.init();
		if (botConfig.TEST_MODE) {
			await CommandsTest.init();
		}

		await CrowniclesDaily.programCronJob();
		await CrowniclesSunday.programCronJob();
		await CrowniclesMonday.programCronJob();

		Crownicles.reportNotifications()
			.then();

		Crownicles.dailyBonusNotifications()
			.then();

		setTimeout(
			Crownicles.fightPowerRegenerationLoop,
			minutesToMilliseconds(FightConstants.POINTS_REGEN_MINUTES)
		);
	}
}
