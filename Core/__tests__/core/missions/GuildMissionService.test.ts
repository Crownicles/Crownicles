import {
	afterEach, describe, expect, it, vi
} from "vitest";
import Guild, { Guilds } from "../../../src/core/database/game/models/Guild";
import Player, { Players } from "../../../src/core/database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { GuildMissionService } from "../../../src/core/missions/GuildMissionService";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { MissionDataController } from "../../../src/data/Mission";
import { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";

describe("GuildMissionService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function createMockPlayer(overrides: Partial<Player> = {}): Player {
		const player = Object.create(Player.prototype);
		Object.assign(player, {
			id: 1, keycloakId: "kc-1", guildId: 42, ...overrides
		});
		return player as Player;
	}

	function createMockGuild(overrides: Partial<Guild> = {}): Guild {
		const guild = Object.create(Guild.prototype);
		Object.assign(guild, {
			id: 42,
			level: 10,
			guildMissionId: "guildMission1",
			guildMissionNumberDone: 0,
			guildMissionObjective: 5,
			guildMissionVariant: 0,
			guildMissionBlob: null,
			guildMissionExpiry: new Date(Date.now() + 24 * 3600 * 1000),
			treasury: 100,
			save: vi.fn().mockResolvedValue(undefined),
			addExperience: vi.fn().mockResolvedValue(undefined),
			addScore: vi.fn().mockResolvedValue(undefined),
			...overrides
		});
		return guild as Guild;
	}

	function createMockMissionInfo(overrides: Partial<PlayerMissionsInfo> = {}): PlayerMissionsInfo {
		const info = Object.create(PlayerMissionsInfo.prototype);
		Object.assign(info, {
			playerId: 1,
			guildMissionContribution: 0,
			save: vi.fn().mockResolvedValue(undefined),
			...overrides
		});
		return info as PlayerMissionsInfo;
	}

	describe("updateGuildMission", () => {
		it("returns false when player has no guild", async () => {
			const player = createMockPlayer({ guildId: null });
			const result = await GuildMissionService.updateGuildMission("anyMission", 1, player, createMockMissionInfo());
			expect(result).toBe(false);
		});

		it("accumulates contribution by count (not by 1) for non-streak missions", async () => {
			const guild = createMockGuild({ guildMissionId: "killMonsters" });
			const player = createMockPlayer();
			const info = createMockMissionInfo();

			vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			vi.spyOn(MissionsController, "getMissionInterface").mockReturnValue({
				areParamsMatchingVariantAndBlob: () => true
			} as never);
			vi.spyOn(MissionDataController.instance, "getById").mockReturnValue({ guildMission: { streak: false } } as never);

			await GuildMissionService.updateGuildMission("killMonsters", 3, player, info);
			expect(info.guildMissionContribution).toBe(3);
			expect(guild.guildMissionNumberDone).toBe(3);
		});

		it("does not bump numberDone twice on the same day for streak missions, but accumulates contribution by count", async () => {
			const today = getDayNumber();
			const blob = Buffer.alloc(4);
			blob.writeInt32LE(today);
			const guild = createMockGuild({
				guildMissionId: "guildDailyStreak",
				guildMissionBlob: blob,
				guildMissionNumberDone: 1
			});
			const player = createMockPlayer();
			const info = createMockMissionInfo({ guildMissionContribution: 0 });

			vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			vi.spyOn(MissionsController, "getMissionInterface").mockReturnValue({
				areParamsMatchingVariantAndBlob: () => true
			} as never);
			vi.spyOn(MissionDataController.instance, "getById").mockReturnValue({ guildMission: { streak: true } } as never);

			await GuildMissionService.updateGuildMission("guildDailyStreak", 4, player, info);
			expect(guild.guildMissionNumberDone).toBe(1);
			expect(info.guildMissionContribution).toBe(4);
		});

		it("resets numberDone when streak is broken (gap > 1 day)", async () => {
			const today = getDayNumber();
			const oldBlob = Buffer.alloc(4);
			oldBlob.writeInt32LE(today - 5);
			const guild = createMockGuild({
				guildMissionId: "guildDailyStreak",
				guildMissionBlob: oldBlob,
				guildMissionNumberDone: 3
			});
			const player = createMockPlayer();
			const info = createMockMissionInfo();

			vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			vi.spyOn(MissionsController, "getMissionInterface").mockReturnValue({
				areParamsMatchingVariantAndBlob: () => true
			} as never);
			vi.spyOn(MissionDataController.instance, "getById").mockReturnValue({ guildMission: { streak: true } } as never);

			await GuildMissionService.updateGuildMission("guildDailyStreak", 1, player, info);
			expect(guild.guildMissionNumberDone).toBe(1);
			expect(guild.guildMissionBlob!.readInt32LE(0)).toBe(today);
		});
	});

	describe("distributeRewards", () => {
		it("is idempotent: a second concurrent call does nothing once mission is reset", async () => {
			const guild = createMockGuild({ guildMissionId: null });
			const player = createMockPlayer();

			const getByIdSpy = vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			const getByGuildSpy = vi.spyOn(Players, "getByGuild").mockResolvedValue([]);

			await GuildMissionService.distributeRewards(player, []);
			expect(getByIdSpy).toHaveBeenCalledOnce();
			expect(getByGuildSpy).not.toHaveBeenCalled();
			expect(guild.save).not.toHaveBeenCalled();
		});

		it("resets the guild mission state after a successful distribution", async () => {
			const guild = createMockGuild({ guildMissionId: "killMonsters" });
			const player = createMockPlayer();

			vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			vi.spyOn(Players, "getByGuild").mockResolvedValue([]);

			await GuildMissionService.distributeRewards(player, []);
			expect(guild.guildMissionId).toBeNull();
			expect(guild.guildMissionNumberDone).toBe(0);
			expect(guild.guildMissionObjective).toBe(0);
			expect(guild.guildMissionExpiry).toBeNull();
			expect(guild.save).toHaveBeenCalled();
		});

		it("rewards only contributors and resets their contribution", async () => {
			const guild = createMockGuild({ guildMissionId: "killMonsters" });
			const player = createMockPlayer();
			const member1 = createMockPlayer({ id: 1, keycloakId: "kc-1" });
			const member2 = createMockPlayer({ id: 2, keycloakId: "kc-2" });
			const info1 = createMockMissionInfo({
				playerId: 1, guildMissionContribution: 5
			});
			const info2 = createMockMissionInfo({
				playerId: 2, guildMissionContribution: 0
			});

			vi.spyOn(Guilds, "getById").mockResolvedValue(guild);
			vi.spyOn(Players, "getByGuild").mockResolvedValue([member1, member2]);
			vi.spyOn(PlayerMissionsInfos, "getOfPlayer").mockImplementation(async id => (id === 1 ? info1 : info2));
			vi.spyOn(InventorySlots, "getPlayerActiveObjects").mockResolvedValue({} as never);
			(member1 as unknown as { addExperience: unknown }).addExperience = vi.fn().mockResolvedValue({ save: vi.fn().mockResolvedValue(undefined) });
			(member2 as unknown as { addExperience: unknown }).addExperience = vi.fn().mockResolvedValue({ save: vi.fn().mockResolvedValue(undefined) });

			const response: never[] = [];
			await GuildMissionService.distributeRewards(player, response);

			expect(member1.addExperience).toHaveBeenCalled();
			expect(member2.addExperience).not.toHaveBeenCalled();
			expect(info1.guildMissionContribution).toBe(0);
			expect(info1.save).toHaveBeenCalled();
			expect(info2.save).not.toHaveBeenCalled();
		});
	});
});
