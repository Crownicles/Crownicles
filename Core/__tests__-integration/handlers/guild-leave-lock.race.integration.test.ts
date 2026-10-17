import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";

type GuildLeaveModule = typeof import("../../src/commands/guild/GuildLeaveCommand");
type LocksModule = typeof import("../../../Lib/src/locks/withLockedEntities");

const N_MEMBERS = 5; // chief + N_MEMBERS-1 regular members

/**
 * Race test for the real locked guild-leave path:
 * `GuildLeaveCommand.runLeaveUnderLock` acquires
 * `[Player, Guild]` (or `[Player, Player, Guild]` when an elder
 * promotion is in flight) with `withLockedEntities` and dispatches
 * the leave / destroy / promote sub-flows inside the critical
 * section. When the chief and every member of the same guild race
 * to leave at once, the lock must serialise them so that:
 *
 * - exactly one call resolves `guildDestroyed` (the chief),
 * - every member resolves either `left` (member won before chief)
 *   or `notInGuild` (chief destroyed the guild first, nulling
 *   their `guildId`),
 * - no call rejects with a lock-conflict or stale-row error,
 * - the final state is consistent: guild gone, zero orphan
 *   players still pointing at it.
 */
describe("GuildLeaveCommand.runLeaveUnderLock race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;
	let mod: GuildLeaveModule;
	let locks: LocksModule;

	beforeAll(async () => {
		env = await setupCoreForTests("guildleavelock");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Guild = env.crownicles.gameDatabase.sequelize.models.Guild as ModelStatic<GuildType>;
		mod = loadProductionModule<GuildLeaveModule>("commands/guild/GuildLeaveCommand");
		locks = loadProductionModule<LocksModule>("../../Lib/src/locks/withLockedEntities");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await Player.destroy({ truncate: true, force: true });
			await Guild.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it("converges with the chief + all members leaving concurrently", async () => {
		const chief = await Player.create({ keycloakId: "race-leave-chief" });
		const memberIds: number[] = [];
		for (let i = 0; i < N_MEMBERS - 1; i++) {
			const member = await Player.create({ keycloakId: `race-leave-member-${i}` });
			memberIds.push(member.id);
		}

		const guild = await Guild.create({
			name: "LockedRaceGuild",
			chiefId: chief.id
		});
		await Player.update({ guildId: guild.id }, { where: { id: chief.id } });
		await Player.update({ guildId: guild.id }, { where: { id: memberIds } });

		// Capture each caller's snapshot of (playerId, elderId, guildId) just like
		// `acceptGuildLeave` does at prompt time. The elder slot is unused (no
		// elder seeded), so each call hits the 2-key lock path.
		const callerKeys = [
			{ playerId: chief.id, elderId: null, guildId: guild.id },
			...memberIds.map(id => ({ playerId: id, elderId: null as null, guildId: guild.id }))
		];

		const values = await runAllOrThrow(
			callerKeys.map(async keys => {
				try {
					return await mod.runLeaveUnderLock([], keys);
				}
				catch (e) {
					// Production caller (`acceptGuildLeave`) downgrades
					// LockedRowNotFoundError to a "notInGuild" response.
					if (e instanceof locks.LockedRowNotFoundError) {
						return { kind: "notInGuild" as const };
					}
					throw e;
				}
			})
		);

		const outcomes = values.map(v => v.kind);

		// Exactly one destruction (the chief's winning branch).
		expect(outcomes.filter(k => k === "guildDestroyed")).toHaveLength(1);

		// No promotions (no elder seeded).
		expect(outcomes).not.toContain("chiefPromotedElder");

		// Every other outcome is either a clean leave or a no-op after destroy.
		for (const kind of outcomes) {
			expect(["guildDestroyed", "left", "notInGuild"]).toContain(kind);
		}

		// Final state: guild gone, no orphan guildId pointers.
		const goneGuild = await Guild.findByPk(guild.id);
		expect(goneGuild).toBeNull();

		const orphans = await Player.count({ where: { guildId: guild.id } });
		expect(orphans).toBe(0);
	});
});
