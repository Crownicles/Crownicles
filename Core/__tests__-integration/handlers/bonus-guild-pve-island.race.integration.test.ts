import {
	afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { MissionSlot as MissionSlotType } from "../../src/core/database/game/models/MissionSlot";
import type {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import type { SmallEventBonusGuildPVEIslandPacket } from "../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";

type ReportSmallEventModule = typeof import("../../src/core/report/ReportSmallEventService");
type RandomUtilsModule = typeof import("../../../Lib/src/utils/RandomUtils");
type MapsModule = typeof import("../../src/core/maps/Maps");
type ErrorPacketModule = typeof import("../../../Lib/src/packets/commands/ErrorPacket");
type GuildModule = typeof import("../../src/core/database/game/models/Guild");
type LogsConstantsModule = typeof import("../../../Lib/src/constants/LogsConstants");

const GUILD_HAS_POINTS_OBJECTIVE = 1_000_000;
const CONCURRENT_GUILD_EXPERIENCE = 7;
const CONCURRENT_MEMBER_MONEY = 11;

type ConcurrentWrite = "guild" | "member";

/**
 * Regression test for #4924.
 *
 * MariaDB >= 11.6 enables `innodb_snapshot_isolation`: inside a
 * REPEATABLE READ transaction, a `SELECT … FOR UPDATE` on a row that
 * another transaction committed after the snapshot was taken fails
 * with `ER_CHECKREAD` (1020, "Record has changed since last read").
 *
 * `bonusGuildPVEIsland` runs inside the reporter's player transaction.
 * It used to lock the guild row and then, through `Guild.addScore`,
 * every guild member's `Player` + `PlayerMissionsInfo` rows from that
 * same long-lived transaction. Guild members are typically all active
 * on the island at the same time, so a concurrent commit on the guild
 * or on any member made the whole small event fail with
 * "Error while executing bonusGuildPVEIsland.js small event".
 *
 * The test opens the reporter's snapshot (consistent read of the
 * guild members, exactly like `Maps.getGuildMembersOnPveIsland`), then
 * commits a change on the guild or on another member from a separate
 * connection, and asserts the small event still succeeds without
 * losing the concurrent write.
 */
describe("bonusGuildPVEIsland small event with concurrent guild activity", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let MissionSlot: ModelStatic<MissionSlotType>;
	let reportSmallEvent: ReportSmallEventModule;
	let randomUtils: RandomUtilsModule;
	let maps: MapsModule;
	let errorPackets: ErrorPacketModule;
	let guildModule: GuildModule;
	let logsConstants: LogsConstantsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("bonusguildpveisland");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Guild = env.crownicles.gameDatabase.sequelize.models.Guild as ModelStatic<GuildType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		MissionSlot = env.crownicles.gameDatabase.sequelize.models.MissionSlot as ModelStatic<MissionSlotType>;
		reportSmallEvent = loadProductionModule<ReportSmallEventModule>("core/report/ReportSmallEventService");
		randomUtils = loadProductionModule<RandomUtilsModule>("../../Lib/src/utils/RandomUtils");
		maps = loadProductionModule<MapsModule>("core/maps/Maps");
		errorPackets = loadProductionModule<ErrorPacketModule>("../../Lib/src/packets/commands/ErrorPacket");
		guildModule = loadProductionModule<GuildModule>("core/database/game/models/Guild");
		logsConstants = loadProductionModule<LogsConstantsModule>("../../Lib/src/constants/LogsConstants");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	beforeEach(async () => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await MissionSlot.destroy({
				truncate: true, force: true
			});
			await PlayerMissionsInfo.destroy({
				truncate: true, force: true
			});
			await Player.destroy({
				truncate: true, force: true
			});
			await Guild.destroy({
				truncate: true, force: true
			});
		}
		finally {
			await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	afterAll(async () => {
		await env?.teardown();
	});

	async function createGuildMember(keycloakId: string, guildId: number): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId, guildId
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		await MissionSlot.create({
			playerId: player.id,
			missionId: "guildHasPoints",
			missionVariant: 0,
			missionObjective: GUILD_HAS_POINTS_OBJECTIVE,
			numberDone: 0,
			expiresAt: new Date(Date.now() + 3_600_000),
			gemsToWin: 0,
			pointsToWin: 0,
			xpToWin: 0,
			moneyToWin: 0
		});
		return player;
	}

	it.each<ConcurrentWrite>(["guild", "member"])("awards guild points when the %s row changes concurrently", async concurrentWrite => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		const guild = await Guild.create({
			name: "IslandGuild", chiefId: 0
		});
		const reporter = await createGuildMember("island-reporter", guild.id);
		const otherMember = await createGuildMember("island-other-member", guild.id);
		await Guild.update({ chiefId: reporter.id }, { where: { id: guild.id } });

		// Lowest roll everywhere: first event, SUCCESS outcome, minimum reward amount.
		vi.spyOn(randomUtils.RandomUtils, "randInt").mockImplementation(min => min);
		// Guild points rather than guild experience: exercises the member mission fan-out.
		vi.spyOn(randomUtils.RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		vi.spyOn(maps.Maps, "getGuildMembersOnPveIsland").mockImplementation(async player => {
			// Consistent read inside the reporter's transaction, like the production helper.
			await Player.findAll({ where: { guildId: player.guildId } });

			// Another guild member commits from their own connection.
			if (concurrentWrite === "guild") {
				await sequelize.query(
					`UPDATE guilds SET experience = experience + ${CONCURRENT_GUILD_EXPERIENCE} WHERE id = ${guild.id}`,
					{ transaction: null }
				);
			}
			else {
				await sequelize.query(
					`UPDATE players SET money = money + ${CONCURRENT_MEMBER_MONEY} WHERE id = ${otherMember.id}`,
					{ transaction: null }
				);
			}
			return [];
		});

		const response: CrowniclesPacket[] = [];
		await reportSmallEvent.executeSmallEvent(response, reporter, {} as PacketContext, "bonusGuildPVEIsland");

		expect(response.filter(packet => packet instanceof errorPackets.ErrorInternalPacket)).toEqual([]);
		const eventPacket = response.find(
			(packet): packet is SmallEventBonusGuildPVEIslandPacket => packet.constructor.name === "SmallEventBonusGuildPVEIslandPacket"
		);
		expect(eventPacket).toMatchObject({
			isExperienceGain: false,
			amount: expect.any(Number)
		});
		const awardedPoints = eventPacket!.amount;
		expect(awardedPoints).toBeGreaterThan(0);

		const freshGuild = await Guild.findByPk(guild.id);
		expect(freshGuild!.score).toBe(awardedPoints);
		expect(freshGuild!.experience).toBe(concurrentWrite === "guild" ? CONCURRENT_GUILD_EXPERIENCE : 0);

		const freshOtherMember = await Player.findByPk(otherMember.id);
		expect(freshOtherMember!.money).toBe(otherMember.money + (concurrentWrite === "member" ? CONCURRENT_MEMBER_MONEY : 0));

		const guildHasPointsSlots = await MissionSlot.findAll({ where: { missionId: "guildHasPoints" } });
		expect(guildHasPointsSlots.map(slot => [slot.playerId, slot.numberDone]).sort()).toEqual(
			[[reporter.id, awardedPoints], [otherMember.id, awardedPoints]].sort()
		);
	});

	it("updates every member's guild mission when a member commits during a guild score gain under the guild lock", async () => {
		const sequelize = env.crownicles.gameDatabase.sequelize;
		const guild = await Guild.create({
			name: "FightGuild", chiefId: 0
		});
		const chief = await createGuildMember("fight-chief", guild.id);
		const otherMember = await createGuildMember("fight-other-member", guild.id);
		const gainedPoints = 42;
		const response: CrowniclesPacket[] = [];

		// Same shape as the PVE fight guild reward: a top-level guild lock crediting points.
		await guildModule.Guild.withLocked(guild.id, async lockedGuild => {
			await Player.findAll({ where: { guildId: guild.id } });
			await sequelize.query(
				`UPDATE players SET money = money + ${CONCURRENT_MEMBER_MONEY} WHERE id = ${otherMember.id}`,
				{ transaction: null }
			);
			await lockedGuild.addScore({
				amount: gainedPoints, response, reason: logsConstants.NumberChangeReason.PVE_FIGHT
			});
			await lockedGuild.save();
		});

		expect((await Guild.findByPk(guild.id))!.score).toBe(gainedPoints);
		const guildHasPointsSlots = await MissionSlot.findAll({ where: { missionId: "guildHasPoints" } });
		expect(guildHasPointsSlots.map(slot => [slot.playerId, slot.numberDone]).sort()).toEqual(
			[[chief.id, gainedPoints], [otherMember.id, gainedPoints]].sort()
		);
	});
});
