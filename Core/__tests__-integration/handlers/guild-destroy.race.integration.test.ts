import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Guild as GuildType } from "../../src/core/database/game/models/Guild";

const N_CONCURRENT = 10;

/**
 * Race test for {@link GuildType.completelyDestroyAndDeleteFromTheDatabase}.
 * The method intentionally does NOT acquire its own row-level lock —
 * it inherits the caller's transaction (documented `@lockInherited`
 * in `GuildLeaveCommand`). The invariant under contention is
 * therefore weaker: concurrent invocations on the same guild must
 * not crash, must converge to "guild gone + members orphaned"
 * regardless of who wins the race, and must not produce
 * inconsistent state (e.g. orphan `guildId` pointers).
 */
describe("Guild.completelyDestroyAndDeleteFromTheDatabase race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Guild: ModelStatic<GuildType>;

	beforeAll(async () => {
		env = await setupCoreForTests("guilddestroy");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		Guild = env.crownicles.gameDatabase.sequelize.models.Guild as ModelStatic<GuildType>;
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

	it(`converges with ${N_CONCURRENT} concurrent destroys on the same guild`, async () => {
		// Seed a chief, a couple of members, and the guild.
		const chief = await Player.create({ keycloakId: "race-guild-chief" });
		const members = await Promise.all(
			Array.from({ length: 4 }, (_, i) => Player.create({ keycloakId: `race-guild-member-${i}` }))
		);
		const guild = await Guild.create({
			name: "RaceGuild",
			chiefId: chief.id
		});
		await Player.update({ guildId: guild.id }, { where: { id: chief.id } });
		await Promise.all(
			members.map(m => Player.update({ guildId: guild.id }, { where: { id: m.id } }))
		);

		const fresh = await Guild.findByPk(guild.id);
		expect(fresh).toBeTruthy();

		const results = await Promise.allSettled(
			Array.from({ length: N_CONCURRENT }, () => fresh!.completelyDestroyAndDeleteFromTheDatabase())
		);

		// At least ONE invocation must succeed cleanly; the others may
		// reject (e.g. transaction conflict) but must not corrupt state.
		const succeeded = results.filter(r => r.status === "fulfilled").length;
		expect(succeeded).toBeGreaterThanOrEqual(1);

		// Final state: guild is gone, no player still points at it.
		const gone = await Guild.findByPk(guild.id);
		expect(gone).toBeNull();

		const orphans = await Player.count({ where: { guildId: guild.id } });
		expect(orphans).toBe(0);
	});
});
