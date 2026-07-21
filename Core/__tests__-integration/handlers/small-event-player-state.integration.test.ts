import {
	afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type { DailyMission as DailyMissionType } from "../../src/core/database/game/models/DailyMission";
import type {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import type { SmallEventClassPacket } from "../../../Lib/src/packets/smallEvents/SmallEventClassPacket";

type ReportSmallEventModule = typeof import("../../src/core/report/ReportSmallEventService");
type RandomUtilsModule = typeof import("../../../Lib/src/utils/RandomUtils");
type ClassConstantsModule = typeof import("../../../Lib/src/constants/ClassConstants");
type LogsConstantsModule = typeof import("../../../Lib/src/constants/LogsConstants");

const HEALTH_GAIN = 3;
const OTHER_CLASS_ID = 17;
const INITIAL_HEALTH = 5;

describe("small event player state", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let DailyMission: ModelStatic<DailyMissionType>;
	let reportSmallEvent: ReportSmallEventModule;
	let randomUtils: RandomUtilsModule;
	let classConstants: ClassConstantsModule;
	let logsConstants: LogsConstantsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("smalleventstate");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		DailyMission = env.crownicles.gameDatabase.sequelize.models.DailyMission as ModelStatic<DailyMissionType>;
		reportSmallEvent = loadProductionModule<ReportSmallEventModule>("core/report/ReportSmallEventService");
		randomUtils = loadProductionModule<RandomUtilsModule>("../../Lib/src/utils/RandomUtils");
		classConstants = loadProductionModule<ClassConstantsModule>("../../Lib/src/constants/ClassConstants");
		logsConstants = loadProductionModule<LogsConstantsModule>("../../Lib/src/constants/LogsConstants");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await DailyMission.destroy({ truncate: true, force: true });
			await MissionSlot.destroy({ truncate: true, force: true });
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it("persists class event health before the doReports mission update", async () => {
		const player = await Player.create({
			keycloakId: "small-event-health",
			class: OTHER_CLASS_ID,
			health: INITIAL_HEALTH
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await MissionSlot.create({
			playerId: player.id,
			missionId: "earnMoney",
			missionVariant: 0,
			missionObjective: 100,
			numberDone: 0,
			expiresAt: new Date(Date.now() + 3_600_000),
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});
		await DailyMission.create({
			id: 0,
			missionId: "doReports",
			missionObjective: 100,
			missionVariant: 0,
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0,
			lastDate: new Date()
		});
		vi.spyOn(randomUtils.RandomUtils.crowniclesRandom, "pick")
			.mockReturnValue(classConstants.ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_HEALTH);
		vi.spyOn(randomUtils.RandomUtils, "rangedInt").mockReturnValue(HEALTH_GAIN);
		const response: CrowniclesPacket[] = [];

		await reportSmallEvent.executeSmallEvent(response, player, {} as PacketContext, "class");

		expect(response).toEqual(expect.arrayContaining([
			expect.objectContaining<Partial<SmallEventClassPacket>>({
				interactionName: classConstants.ClassConstants.CLASS_SMALL_EVENT_INTERACTIONS_NAMES.WIN_HEALTH
			})
		]));
		const freshPlayer = await Player.findByPk(player.id);
		expect(freshPlayer?.getHealthValue()).toBe(INITIAL_HEALTH + HEALTH_GAIN);
	});

	it("persists health atomically with mission state", async () => {
		const player = await Player.create({
			keycloakId: "direct-health",
			class: OTHER_CLASS_ID,
			health: INITIAL_HEALTH
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await DailyMission.create({
			id: 0,
			missionId: "doReports",
			missionObjective: 100,
			missionVariant: 0,
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0,
			lastDate: new Date()
		});

		await player.addHealth({
			amount: HEALTH_GAIN,
			response: [],
			reason: logsConstants.NumberChangeReason.SMALL_EVENT
		});
		expect(player.getHealthValue()).toBe(INITIAL_HEALTH + HEALTH_GAIN);
		expect(player.changed("health")).toBe(false);

		const freshPlayer = await Player.findByPk(player.id);
		expect(freshPlayer?.getHealthValue()).toBe(INITIAL_HEALTH + HEALTH_GAIN);
	});

	it("full-heals from the locked state when the caller is stale", async () => {
		const player = await Player.create({
			keycloakId: "stale-full-heal",
			class: OTHER_CLASS_ID,
			health: INITIAL_HEALTH
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await DailyMission.create({
			id: 0,
			missionId: "doReports",
			missionObjective: 100,
			missionVariant: 0,
			gemsToWin: 0,
			xpToWin: 0,
			pointsToWin: 0,
			moneyToWin: 0,
			lastDate: new Date()
		});
		player.setHealthNoCheck(player.getMaxHealth());

		await player.addHealth({
			amount: player.getMaxHealth(),
			response: [],
			reason: logsConstants.NumberChangeReason.GUILD_DAILY,
			missionHealthParameter: {
				shouldPokeMission: true,
				overHealCountsForMission: false
			}
		});

		const freshPlayer = await Player.findByPk(player.id);
		expect(freshPlayer?.getHealthValue()).toBe(player.getMaxHealth());
	});
});
