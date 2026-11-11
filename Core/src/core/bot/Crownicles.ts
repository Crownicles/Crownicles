import { PacketListenerServer } from "../../../../Lib/src/packets/PacketListener";
import { GameDatabase } from "../database/game/GameDatabase";
import { LogsDatabase } from "../database/logs/LogsDatabase";
import { botConfig } from "../../bootstrap";
import {
	Op, Sequelize
} from "sequelize";
import { minutesToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";
import { TimeoutFunctionsConstants } from "../../../../Lib/src/constants/TimeoutFunctionsConstants";
import { asMilliseconds } from "../../../../Lib/src/types/TimeTypes";
import { MapCache } from "../maps/MapCache";
import { registerAllPacketHandlers } from "../packetHandlers/PacketHandler";
import { CommandsTest } from "../CommandsTest";
import Player from "../database/game/models/Player";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { PacketUtils } from "../utils/PacketUtils";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";

// skipcq: JS-C1003 - fs does not expose itself as an ES Module.
import * as fs from "fs";
import { initializeAllClassBehaviors } from "../fights/AiBehaviorController";
import { initializeAllPetBehaviors } from "../fights/PetAssistManager";
import { CrowniclesCoreWebServer } from "./CrowniclesCoreWebServer";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { FightsManager } from "../fights/FightsManager";
import { BlessingManager } from "../blessings/BlessingManager";
import { EnergyFullNotificationPacket } from "../../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import { DailyBonusNotificationPacket } from "../../../../Lib/src/packets/notifications/DailyBonusNotificationPacket";
import { ScheduledDailyBonusNotifications } from "../database/game/models/ScheduledDailyBonusNotification";
import { processDueExpeditionNotifications } from "./ExpeditionNotifications";
import { processDueReportNotifications } from "./ReportNotifications";
import { CrowniclesDaily } from "./cronJobs/CrowniclesDaily";
import { CrowniclesSunday } from "./cronJobs/CrowniclesSunday";
import { CrowniclesMonday } from "./cronJobs/CrowniclesMonday";
import { CrowniclesEach10Minutes } from "./cronJobs/CrowniclesEach10Minutes";
import { CrowniclesChristmas } from "./cronJobs/CrowniclesChristmas";
import { ReleaseGift } from "./ReleaseGift";
import { getKingChallengeThresholds } from "../kingChallenge/KingChallenge";
import { insertMissingKingGuards } from "../fights/kingGuards/KingGuardMatchmaking";
import {
	PERIODIC_LOOPS, startResilientLoop
} from "./ResilientLoop";

export class Crownicles {
	public readonly packetListener: PacketListenerServer;

	public readonly gameDatabase: GameDatabase;

	public logsDatabase: LogsDatabase;

	/**
	 * Test-only helper. Replaces {@link logsDatabase} with a stub so
	 * integration tests don't have to provision the logs schema.
	 *
	 * Must only be called from `__tests__-integration/_coreSetup.ts`.
	 */
	public setLogsDatabaseForTests(stub: LogsDatabase): void {
		this.logsDatabase = stub;
	}

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
		const regenAmount = FightConstants.POINTS_REGEN_AMOUNT * BlessingManager.getInstance()
			.getEnergyRegenMultiplier();

		const notifications = await Player.findAll(
			{
				where: {
					[Op.and]: [
						{ fightPointsLost: { [Op.lte]: regenAmount } },
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

		await Player.update(
			{
				fightPointsLost: Sequelize.literal(
					`CASE WHEN fightPointsLost - ${regenAmount} < 0 THEN 0 ELSE fightPointsLost - ${regenAmount} END`
				)
			},
			{
				where: {
					fightPointsLost: { [Op.not]: 0 },
					mapLinkId: { [Op.in]: MapCache.regenEnergyMapLinks }
				}
			}
		);
	}

	static async reportNotifications(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error(`MQTT is not connected, can't do report notifications. Trying again in ${TimeoutFunctionsConstants.REPORT_NOTIFICATIONS} ms`);
			return;
		}
		await processDueReportNotifications();
	}

	static async dailyBonusNotifications(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error(`MQTT is not connected, can't do daily bonus notifications. Trying again in ${TimeoutFunctionsConstants.DAILY_TIMEOUT} ms`);
			return;
		}
		const notifications = await ScheduledDailyBonusNotifications.getNotificationsBeforeDate(new Date());
		if (notifications.length !== 0) {
			PacketUtils.sendNotifications(notifications.map(notification => makePacket(DailyBonusNotificationPacket, {
				keycloakId: notification.keycloakId
			})));
			await ScheduledDailyBonusNotifications.bulkDelete(notifications);
		}
	}

	static async expeditionNotifications(): Promise<void> {
		if (!PacketUtils.isMqttConnected()) {
			CrowniclesLogger.error(`MQTT is not connected, can't do expedition notifications. Trying again in ${TimeoutFunctionsConstants.EXPEDITION_NOTIFICATIONS} ms`);
			return;
		}
		await processDueExpeditionNotifications();
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
		await BlessingManager.getInstance()
			.init();

		/*
		 * Creates the setting rows of the thresholds before concurrent score gains could race to insert them,
		 * or read under lock a row inserted after the snapshot of their transaction
		 */
		await getKingChallengeThresholds();

		// The guards added to the library start with their initial rating, the others keep the one they earned
		await insertMissingKingGuards();
		if (botConfig.TEST_MODE) {
			await CommandsTest.init();
		}

		await CrowniclesDaily.programCronJob();
		await CrowniclesSunday.programCronJob();
		await CrowniclesMonday.programCronJob();
		await CrowniclesEach10Minutes.programCronJob();
		await CrowniclesChristmas.programCronJob();

		startResilientLoop(
			PERIODIC_LOOPS.REPORT_NOTIFICATIONS,
			Crownicles.reportNotifications,
			asMilliseconds(TimeoutFunctionsConstants.REPORT_NOTIFICATIONS),
			{ startImmediately: true }
		);

		startResilientLoop(
			PERIODIC_LOOPS.DAILY_BONUS_NOTIFICATIONS,
			Crownicles.dailyBonusNotifications,
			asMilliseconds(TimeoutFunctionsConstants.DAILY_TIMEOUT),
			{ startImmediately: true }
		);

		startResilientLoop(
			PERIODIC_LOOPS.EXPEDITION_NOTIFICATIONS,
			Crownicles.expeditionNotifications,
			asMilliseconds(TimeoutFunctionsConstants.EXPEDITION_NOTIFICATIONS),
			{ startImmediately: true }
		);

		ReleaseGift.apply()
			.then();

		startResilientLoop(
			PERIODIC_LOOPS.ENERGY_REGEN,
			Crownicles.fightPowerRegenerationLoop,
			minutesToMilliseconds(FightConstants.POINTS_REGEN_MINUTES),
			{ startImmediately: false }
		);
	}
}
